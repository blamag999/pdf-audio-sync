// Ứng dụng đọc PDF và đồng bộ Audio theo từng trang (PDF Audio Sync v2.5)

// STATE CHÍNH CỦA ỨNG DỤNG
const state = {
  pdfDoc: null,
  pageNum: 1,
  totalPages: 0,
  pageRendering: false,
  pageNumPending: null,
  pdfFileName: '',
  audioFileName: '',
  folderName: '',
  dirHandle: null,

  // Mốc thời gian: { [pageNumber]: timestampInSeconds }
  pageTimestamps: {},
  autoPageTurn: true,
  autoSeekAudio: true,
  isAudioDrivenChange: false,

  // CHẾ ĐỘ HIỂN THỊ
  viewMode: 'fit-width', // 'fit-width' | 'fit-height' | 'two-pages'
  zoomScale: 1.0,

  speeds: [0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
  speedIndex: 1
};

// INDEXEDDB ĐỂ GHI NHỚ VÀ TỰ ĐỘNG NẠP MP3 KHI CHỌN PDF
const DB_NAME = 'PdfAudioSyncDB';
const DB_STORE = 'audio_pairs';
let dbInstance = null;

function initIndexedDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    request.onerror = () => resolve(null);
  });
}

async function saveAudioPairToDB(key, audioName, audioBlob) {
  if (!dbInstance) await initIndexedDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.put({ key: key.toLowerCase(), audioName, audioBlob, updatedAt: Date.now() });
  } catch (err) {
    console.log('Lỗi lưu IndexedDB: ', err);
  }
}

async function getAudioPairFromDB(key) {
  if (!dbInstance) await initIndexedDB();
  if (!dbInstance) return null;
  return new Promise((resolve) => {
    try {
      const tx = dbInstance.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(key.toLowerCase());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

// DOM ELEMENTS
const dom = {
  btnFitWidth: document.getElementById('btnFitWidth'),
  btnFitHeight: document.getElementById('btnFitHeight'),
  btnTwoPages: document.getElementById('btnTwoPages'),
  btnZoomOut: document.getElementById('btnZoomOut'),
  btnZoomIn: document.getElementById('btnZoomIn'),
  lblZoomLevel: document.getElementById('lblZoomLevel'),

  combinedFileInput: document.getElementById('combinedFileInput'),
  btnPickFolder: document.getElementById('btnPickFolder'),
  folderInput: document.getElementById('folderInput'),
  pdfFileName: document.getElementById('pdfFileName'),
  audioFileName: document.getElementById('audioFileName'),
  filePickerSection: document.getElementById('filePickerSection'),
  btnToggleSettings: document.getElementById('btnToggleSettings'),

  viewerContainer: document.getElementById('viewerContainer'),
  dropOverlay: document.getElementById('dropOverlay'),
  emptyState: document.getElementById('emptyState'),
  canvasWrapper: document.getElementById('canvasWrapper'),
  pageLeftWrapper: document.getElementById('pageLeftWrapper'),
  pageRightWrapper: document.getElementById('pageRightWrapper'),
  pdfCanvasLeft: document.getElementById('pdfCanvasLeft'),
  pdfCanvasRight: document.getElementById('pdfCanvasRight'),
  pdfLoadingIndicator: document.getElementById('pdfLoadingIndicator'),

  lblPagePrefix: document.getElementById('lblPagePrefix'),
  lblCurrentPage: document.getElementById('lblCurrentPage'),
  lblTotalPages: document.getElementById('lblTotalPages'),
  lblPageTimestamp: document.getElementById('lblPageTimestamp'),
  lblSaveStatus: document.getElementById('lblSaveStatus'),
  btnPinCurrentTime: document.getElementById('btnPinCurrentTime'),
  btnSaveToFolder: document.getElementById('btnSaveToFolder'),

  audioElement: document.getElementById('audioElement'),
  audioSeeker: document.getElementById('audioSeeker'),
  lblAudioCurrentTime: document.getElementById('lblAudioCurrentTime'),
  lblAudioDuration: document.getElementById('lblAudioDuration'),
  btnPrevPage: document.getElementById('btnPrevPage'),
  btnNextPage: document.getElementById('btnNextPage'),
  btnPlayPause: document.getElementById('btnPlayPause'),
  btnRewind5: document.getElementById('btnRewind5'),
  btnForward5: document.getElementById('btnForward5'),
  btnSpeed: document.getElementById('btnSpeed'),

  chkAutoPageTurn: document.getElementById('chkAutoPageTurn'),
  chkAutoSeekAudio: document.getElementById('chkAutoSeekAudio'),

  btnOpenSyncModal: document.getElementById('btnOpenSyncModal'),
  btnCloseSyncModal: document.getElementById('btnCloseSyncModal'),
  syncModal: document.getElementById('syncModal'),
  syncTableBody: document.getElementById('syncTableBody'),
  btnExportSync: document.getElementById('btnExportSync'),
  importSyncInput: document.getElementById('importSyncInput'),
  btnClearSync: document.getElementById('btnClearSync'),
  toastMessage: document.getElementById('toastMessage')
};

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getFileStem(filename) {
  return filename.replace(/\.[^/.]+$/, "").trim().toLowerCase();
}

function showToast(msg) {
  dom.toastMessage.textContent = msg;
  dom.toastMessage.classList.remove('hidden');
  setTimeout(() => {
    dom.toastMessage.classList.add('hidden');
  }, 3500);
}

// KHỞI TẠO CÁC SỰ KIỆN
function initEvents() {
  initIndexedDB();

  // Chế độ xem PDF
  dom.btnFitWidth.addEventListener('click', () => setViewMode('fit-width'));
  dom.btnFitHeight.addEventListener('click', () => setViewMode('fit-height'));
  dom.btnTwoPages.addEventListener('click', () => setViewMode('two-pages'));
  dom.btnZoomIn.addEventListener('click', () => changeZoom(0.15));
  dom.btnZoomOut.addEventListener('click', () => changeZoom(-0.15));

  // 1. CHỌN CẢ PDF & MP3 CÙNG LÚC
  dom.combinedFileInput.addEventListener('change', handleCombinedFilesSelected);

  // 2. MỞ THƯ MỤC TRUYỆN
  dom.btnPickFolder.addEventListener('click', handleFolderPick);
  dom.folderInput.addEventListener('change', (e) => handleFileList(Array.from(e.target.files)));

  // KÉO THẢ FILE TRỰC TIẾP VÀO MÀN HÌNH (DRAG & DROP)
  initDragAndDrop();

  // Toggle bảng chọn file
  dom.btnToggleSettings.addEventListener('click', () => {
    dom.filePickerSection.classList.toggle('collapsed');
  });

  dom.chkAutoPageTurn.addEventListener('change', (e) => { state.autoPageTurn = e.target.checked; });
  dom.chkAutoSeekAudio.addEventListener('change', (e) => { state.autoSeekAudio = e.target.checked; });

  // Điều khiển lật trang
  dom.btnPrevPage.addEventListener('click', () => changePage(-1));
  dom.btnNextPage.addEventListener('click', () => changePage(1));

  // Ghim mốc & Lưu mốc
  dom.btnPinCurrentTime.addEventListener('click', pinCurrentTimeToPage);
  dom.btnSaveToFolder.addEventListener('click', saveSyncToDirectoryOrDownload);

  // Audio Play/Pause
  dom.btnPlayPause.addEventListener('click', togglePlayPause);
  dom.btnRewind5.addEventListener('click', () => {
    dom.audioElement.currentTime = Math.max(0, dom.audioElement.currentTime - 5);
  });
  dom.btnForward5.addEventListener('click', () => {
    dom.audioElement.currentTime = Math.min(dom.audioElement.duration || 0, dom.audioElement.currentTime + 5);
  });
  dom.btnSpeed.addEventListener('click', cycleSpeed);

  dom.audioElement.addEventListener('timeupdate', onAudioTimeUpdate);
  dom.audioElement.addEventListener('loadedmetadata', onAudioMetadataLoaded);
  dom.audioElement.addEventListener('play', () => { dom.btnPlayPause.textContent = '⏸'; });
  dom.audioElement.addEventListener('pause', () => { dom.btnPlayPause.textContent = '▶'; });

  dom.audioSeeker.addEventListener('input', (e) => {
    dom.audioElement.currentTime = parseFloat(e.target.value);
  });

  // Modal mốc đồng bộ
  dom.btnOpenSyncModal.addEventListener('click', openSyncModal);
  dom.btnCloseSyncModal.addEventListener('click', () => dom.syncModal.classList.add('hidden'));
  dom.syncModal.addEventListener('click', (e) => {
    if (e.target === dom.syncModal) dom.syncModal.classList.add('hidden');
  });

  dom.btnExportSync.addEventListener('click', exportSyncData);
  dom.importSyncInput.addEventListener('change', importSyncData);
  dom.btnClearSync.addEventListener('click', clearAllSync);

  initTouchGestures();

  window.addEventListener('resize', debounce(() => {
    if (state.pdfDoc) renderCurrentSpread();
  }, 300));
}

// =======================================================
// TỰ ĐỘNG KHỚP CẶP PDF VÀ MP3 THÔNG MINH
// =======================================================
function handleCombinedFilesSelected(e) {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;
  handleFileList(files);
}

async function handleFileList(files) {
  if (!files || files.length === 0) return;

  const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
  const audioFiles = files.filter(f => {
    const l = f.name.toLowerCase();
    return l.endsWith('.mp3') || l.endsWith('.m4a') || l.endsWith('.wav') || l.endsWith('.ogg') || l.endsWith('.aac');
  });
  const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));

  // 1. Xử lý nạp PDF
  let selectedPdf = pdfFiles[0] || null;
  let selectedAudio = null;
  let selectedJson = jsonFiles[0] || null;

  if (selectedPdf) {
    const pdfStem = getFileStem(selectedPdf.name);

    // Tìm file Audio có tên tương ứng với file PDF
    if (audioFiles.length > 0) {
      selectedAudio = audioFiles.find(a => getFileStem(a.name) === pdfStem) || audioFiles[0];
    }

    // Tìm file Json mốc có tên tương ứng
    if (jsonFiles.length > 0) {
      selectedJson = jsonFiles.find(j => getFileStem(j.name).includes(pdfStem)) || jsonFiles[0];
    }

    // Nạp PDF
    await loadPdfFromBlob(selectedPdf);

    // Nếu có file Audio đi kèm -> Nạp ngay và ghi nhớ vào IndexedDB
    if (selectedAudio) {
      loadAudioFromBlob(selectedAudio);
      saveAudioPairToDB(pdfStem, selectedAudio.name, selectedAudio);
      showToast(`🎉 Đã tự động khớp: ${selectedAudio.name}`);
    } else {
      // NẾU NGƯỜI DÙNG CHỈ CHỌN MỖI PDF:
      // Tự động kiểm tra trong bộ nhớ IndexedDB xem trước đây đã từng nghe audio nào cho PDF này chưa!
      const cached = await getAudioPairFromDB(pdfStem);
      if (cached && cached.audioBlob) {
        loadAudioFromBlob(cached.audioBlob);
        dom.audioFileName.textContent = `🎵 ${cached.audioName} (Tự nhớ)`;
        dom.audioFileName.classList.remove('empty');
        showToast(`⚡ Tự động nạp lại audio: ${cached.audioName}`);
      }
    }

    // Nạp file mốc JSON nếu có
    if (selectedJson) {
      try {
        const text = await selectedJson.text();
        state.pageTimestamps = JSON.parse(text);
        saveSyncToStorage();
        updatePageTimestampBadge();
      } catch (err) {
        console.error('Không thể nạp file JSON:', err);
      }
    }
  } else if (audioFiles.length > 0) {
    // Chỉ chọn audio
    loadAudioFromBlob(audioFiles[0]);
    showToast(`🎵 Đã nạp audio: ${audioFiles[0].name}`);
  }
}

// =======================================================
// KÉO THẢ FILE TRỰC TIẾP (DRAG & DROP)
// =======================================================
function initDragAndDrop() {
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropOverlay.classList.remove('hidden');
  });

  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null || e.clientX <= 0 || e.clientY <= 0) {
      dom.dropOverlay.classList.add('hidden');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropOverlay.classList.add('hidden');
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFileList(Array.from(dt.files));
    }
  });
}

// =======================================================
// CHỌN THƯ MỤC
// =======================================================
async function handleFolderPick() {
  if ('showDirectoryPicker' in window) {
    try {
      state.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      state.folderName = state.dirHandle.name;

      const files = [];
      for await (const entry of state.dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          files.push(file);
        }
      }
      await handleFileList(files);
      updateSaveStatusBadge('🟢 Tự lưu vào thư mục');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  dom.folderInput.click();
}

// ==========================================
// CHẾ ĐỘ HIỂN THỊ (VIEW MODES)
// ==========================================
function setViewMode(mode) {
  state.viewMode = mode;
  state.zoomScale = 1.0;
  updateZoomLabel();

  dom.btnFitWidth.classList.toggle('active', mode === 'fit-width');
  dom.btnFitHeight.classList.toggle('active', mode === 'fit-height');
  dom.btnTwoPages.classList.toggle('active', mode === 'two-pages');

  if (mode === 'two-pages') {
    dom.canvasWrapper.classList.add('two-page-mode');
  } else {
    dom.canvasWrapper.classList.remove('two-page-mode');
  }

  if (state.pdfDoc) renderCurrentSpread();
}

function changeZoom(delta) {
  const newZoom = Math.max(0.5, Math.min(3.0, state.zoomScale + delta));
  state.zoomScale = Math.round(newZoom * 100) / 100;
  updateZoomLabel();
  if (state.pdfDoc) renderCurrentSpread();
}

function updateZoomLabel() {
  dom.lblZoomLevel.textContent = `${Math.round(state.zoomScale * 100)}%`;
}

// ==========================================
// TẢI FILE VÀ RENDER PDF
// ==========================================
async function loadPdfFromBlob(file) {
  state.pdfFileName = file.name;
  dom.pdfFileName.textContent = `📄 ${file.name}`;
  dom.pdfFileName.classList.remove('empty');
  dom.pdfLoadingIndicator.classList.remove('hidden');

  try {
    const buffer = await file.arrayBuffer();
    const typedarray = new Uint8Array(buffer);
    state.pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
    state.totalPages = state.pdfDoc.numPages;
    state.pageNum = 1;

    dom.lblTotalPages.textContent = state.totalPages;
    dom.emptyState.classList.add('hidden');
    dom.canvasWrapper.classList.remove('hidden');
    dom.pdfLoadingIndicator.classList.add('hidden');

    loadSyncFromStorage();
    renderCurrentSpread();
  } catch (error) {
    alert('Không thể mở file PDF: ' + error.message);
    dom.pdfLoadingIndicator.classList.add('hidden');
  }
}

function loadAudioFromBlob(file) {
  state.audioFileName = file.name;
  dom.audioFileName.textContent = `🎵 ${file.name}`;
  dom.audioFileName.classList.remove('empty');

  const objectUrl = URL.createObjectURL(file);
  dom.audioElement.src = objectUrl;
  dom.audioElement.load();
}

async function renderCurrentSpread() {
  if (!state.pdfDoc) return;
  if (state.pageRendering) {
    state.pageNumPending = state.pageNum;
    return;
  }
  state.pageRendering = true;

  const isTwoPages = state.viewMode === 'two-pages';
  const containerW = dom.viewerContainer.clientWidth - 32;
  const containerH = dom.viewerContainer.clientHeight - 32;

  let leftPageNum = state.pageNum;
  let rightPageNum = isTwoPages && (leftPageNum + 1 <= state.totalPages) ? leftPageNum + 1 : null;

  if (isTwoPages && rightPageNum) {
    dom.lblPagePrefix.textContent = 'Trang';
    dom.lblCurrentPage.textContent = `${leftPageNum} - ${rightPageNum}`;
  } else {
    dom.lblPagePrefix.textContent = 'Trang';
    dom.lblCurrentPage.textContent = `${leftPageNum}`;
  }
  updatePageTimestampBadge();

  try {
    const pageLeft = await state.pdfDoc.getPage(leftPageNum);
    const unscaledLeft = pageLeft.getViewport({ scale: 1 });

    let pageRight = null;
    let unscaledRight = null;
    if (rightPageNum) {
      pageRight = await state.pdfDoc.getPage(rightPageNum);
      unscaledRight = pageRight.getViewport({ scale: 1 });
    }

    let scale = 1.0;
    if (state.viewMode === 'fit-width') {
      scale = (containerW / unscaledLeft.width) * state.zoomScale;
      dom.pageRightWrapper.classList.add('hidden');
    } else if (state.viewMode === 'fit-height') {
      scale = (containerH / unscaledLeft.height) * state.zoomScale;
      dom.pageRightWrapper.classList.add('hidden');
    } else if (isTwoPages) {
      const combinedWidth = unscaledRight ? (unscaledLeft.width + unscaledRight.width + 16) : unscaledLeft.width;
      const maxHeight = unscaledRight ? Math.max(unscaledLeft.height, unscaledRight.height) : unscaledLeft.height;
      const scaleW = (containerW / combinedWidth);
      const scaleH = (containerH / maxHeight);
      scale = Math.min(scaleW, scaleH) * state.zoomScale;
    }

    const viewportLeft = pageLeft.getViewport({ scale: Math.max(scale, 0.4) });
    dom.pdfCanvasLeft.height = viewportLeft.height;
    dom.pdfCanvasLeft.width = viewportLeft.width;
    const ctxLeft = dom.pdfCanvasLeft.getContext('2d');
    await pageLeft.render({ canvasContext: ctxLeft, viewport: viewportLeft }).promise;

    if (isTwoPages && pageRight) {
      dom.pageRightWrapper.classList.remove('hidden');
      const viewportRight = pageRight.getViewport({ scale: Math.max(scale, 0.4) });
      dom.pdfCanvasRight.height = viewportRight.height;
      dom.pdfCanvasRight.width = viewportRight.width;
      const ctxRight = dom.pdfCanvasRight.getContext('2d');
      await pageRight.render({ canvasContext: ctxRight, viewport: viewportRight }).promise;
    } else {
      dom.pageRightWrapper.classList.add('hidden');
    }

  } catch (err) {
    console.error('Lỗi khi render trang:', err);
  } finally {
    state.pageRendering = false;
    if (state.pageNumPending !== null) {
      state.pageNumPending = null;
      renderCurrentSpread();
    }
  }

  if (state.autoSeekAudio && !state.isAudioDrivenChange) {
    const targetTimestamp = state.pageTimestamps[leftPageNum];
    if (typeof targetTimestamp === 'number') {
      dom.audioElement.currentTime = targetTimestamp;
    }
  }
}

function changePage(delta) {
  if (!state.pdfDoc) return;
  const step = (state.viewMode === 'two-pages') ? 2 * delta : delta;
  const newPage = state.pageNum + step;

  if (newPage >= 1 && newPage <= state.totalPages) {
    state.pageNum = newPage;
    state.isAudioDrivenChange = false;
    renderCurrentSpread();
  } else if (delta > 0 && state.pageNum < state.totalPages) {
    state.pageNum = state.totalPages;
    state.isAudioDrivenChange = false;
    renderCurrentSpread();
  } else if (delta < 0 && state.pageNum > 1) {
    state.pageNum = 1;
    state.isAudioDrivenChange = false;
    renderCurrentSpread();
  }
}

function updatePageTimestampBadge() {
  const ts = state.pageTimestamps[state.pageNum];
  if (typeof ts === 'number') {
    dom.lblPageTimestamp.textContent = `Mốc: ${formatTime(ts)}`;
    dom.lblPageTimestamp.style.color = '#38bdf8';
  } else {
    dom.lblPageTimestamp.textContent = 'Mốc: Chưa gán';
    dom.lblPageTimestamp.style.color = '#94a3b8';
  }
}

function updateSaveStatusBadge(text) {
  dom.lblSaveStatus.textContent = text;
}

// ==========================================
// GHIM & TỰ ĐỘNG LƯU MỐC
// ==========================================
async function pinCurrentTimeToPage() {
  if (!state.pdfDoc) {
    alert('Vui lòng chọn file PDF trước!');
    return;
  }
  const currentTime = dom.audioElement.currentTime || 0;
  state.pageTimestamps[state.pageNum] = Math.round(currentTime * 10) / 10;

  saveSyncToStorage();
  await autoSaveToDirectoryIfPossible();
  updatePageTimestampBadge();

  const originalText = dom.btnPinCurrentTime.textContent;
  dom.btnPinCurrentTime.textContent = `Đã ghim: ${formatTime(currentTime)}!`;
  dom.btnPinCurrentTime.style.backgroundColor = '#10b981';
  setTimeout(() => {
    dom.btnPinCurrentTime.textContent = originalText;
    dom.btnPinCurrentTime.style.backgroundColor = '';
  }, 1200);
}

async function autoSaveToDirectoryIfPossible() {
  if (state.dirHandle && 'createWritable' in FileSystemFileHandle.prototype) {
    try {
      const fileName = getSyncFileName();
      const fileHandle = await state.dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(state.pageTimestamps, null, 2));
      await writable.close();
      updateSaveStatusBadge(`🟢 Đã lưu vào ${fileName}`);
      return true;
    } catch (e) {
      console.log('Không thể ghi thư mục: ', e);
    }
  }
  updateSaveStatusBadge('💾 Đã lưu vào máy');
  return false;
}

function getSyncFileName() {
  const baseName = state.pdfFileName ? state.pdfFileName.replace(/\.[^/.]+$/, "") : "pdf_audio";
  return `${baseName}_sync.json`;
}

async function saveSyncToDirectoryOrDownload() {
  if (Object.keys(state.pageTimestamps).length === 0) {
    alert('Chưa có mốc thời gian nào để lưu!');
    return;
  }

  const savedDirectly = await autoSaveToDirectoryIfPossible();
  if (savedDirectly) {
    showToast(`🎉 Đã lưu file [${getSyncFileName()}] vào thư mục!`);
  } else {
    exportSyncData();
    showToast(`💾 Đã tải file [${getSyncFileName()}] về máy!`);
  }
}

// ==========================================
// PHÁT AUDIO & TỰ ĐỘNG CHUYỂN TRANG
// ==========================================
function togglePlayPause() {
  if (!dom.audioElement.src) {
    alert('Chưa có file MP3 nào được nạp!');
    return;
  }
  if (dom.audioElement.paused) {
    dom.audioElement.play();
  } else {
    dom.audioElement.pause();
  }
}

function cycleSpeed() {
  state.speedIndex = (state.speedIndex + 1) % state.speeds.length;
  const newSpeed = state.speeds[state.speedIndex];
  dom.audioElement.playbackRate = newSpeed;
  dom.btnSpeed.textContent = `${newSpeed}x`;
}

function onAudioMetadataLoaded() {
  const duration = dom.audioElement.duration || 0;
  dom.audioSeeker.max = duration;
  dom.lblAudioDuration.textContent = formatTime(duration);
}

function onAudioTimeUpdate() {
  const curr = dom.audioElement.currentTime;
  dom.audioSeeker.value = curr;
  dom.lblAudioCurrentTime.textContent = formatTime(curr);

  if (state.autoPageTurn && state.pdfDoc && Object.keys(state.pageTimestamps).length > 0) {
    let matchedPage = null;
    let maxTime = -1;

    for (const [pageStr, timestamp] of Object.entries(state.pageTimestamps)) {
      const p = parseInt(pageStr, 10);
      if (curr >= timestamp && timestamp > maxTime) {
        maxTime = timestamp;
        matchedPage = p;
      }
    }

    if (matchedPage) {
      let shouldTurn = false;
      if (state.viewMode === 'two-pages') {
        const inCurrentSpread = (matchedPage === state.pageNum || matchedPage === state.pageNum + 1);
        if (!inCurrentSpread) shouldTurn = true;
      } else {
        if (matchedPage !== state.pageNum) shouldTurn = true;
      }

      if (shouldTurn) {
        state.isAudioDrivenChange = true;
        state.pageNum = matchedPage;
        renderCurrentSpread();
        setTimeout(() => { state.isAudioDrivenChange = false; }, 400);
      }
    }
  }
}

// LOCALSTORAGE
function getStorageKey() {
  return `pdf_sync_${state.pdfFileName || state.folderName || 'default'}`;
}

function saveSyncToStorage() {
  if (!state.pdfFileName && !state.folderName) return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state.pageTimestamps));
  } catch (e) {
    console.error(e);
  }
}

function loadSyncFromStorage() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      state.pageTimestamps = JSON.parse(raw);
    }
  } catch (e) {
    console.error(e);
  }
}

// MODAL QUẢN LÝ MỐC
function openSyncModal() {
  renderSyncTable();
  dom.syncModal.classList.remove('hidden');
}

function renderSyncTable() {
  dom.syncTableBody.innerHTML = '';
  const total = state.totalPages || 10;

  for (let p = 1; p <= total; p++) {
    const tr = document.createElement('tr');
    const ts = state.pageTimestamps[p];
    const hasTime = typeof ts === 'number';

    tr.innerHTML = `
      <td><b>Trang ${p}</b></td>
      <td>${hasTime ? formatTime(ts) : '<span style="color:#64748b;">(Chưa có)</span>'}</td>
      <td>
        ${hasTime ? `<button class="btn-mini-play" onclick="seekAndPlayTo(${ts}, ${p})">▶ Nghe thử</button>` : ''}
        ${hasTime ? `<button class="btn-mini-del" onclick="deleteSync(${p})">✕ Xóa</button>` : ''}
        <button class="btn-mini-play" onclick="setManualSync(${p})">✏️ Đặt</button>
      </td>
    `;
    dom.syncTableBody.appendChild(tr);
  }
}

window.seekAndPlayTo = function(seconds, page) {
  dom.audioElement.currentTime = seconds;
  dom.audioElement.play();
  state.pageNum = page;
  renderCurrentSpread();
  dom.syncModal.classList.add('hidden');
};

window.deleteSync = async function(page) {
  delete state.pageTimestamps[page];
  saveSyncToStorage();
  await autoSaveToDirectoryIfPossible();
  updatePageTimestampBadge();
  renderSyncTable();
};

window.setManualSync = async function(page) {
  const currentVal = state.pageTimestamps[page] || Math.floor(dom.audioElement.currentTime || 0);
  const input = prompt(`Nhập số giây bắt đầu cho Trang ${page} (hoặc dạng MM:SS):`, formatTime(currentVal));
  if (!input) return;

  let seconds = 0;
  if (input.includes(':')) {
    const parts = input.split(':').map(Number);
    if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else {
    seconds = parseFloat(input);
  }

  if (!isNaN(seconds) && seconds >= 0) {
    state.pageTimestamps[page] = seconds;
    saveSyncToStorage();
    await autoSaveToDirectoryIfPossible();
    updatePageTimestampBadge();
    renderSyncTable();
  } else {
    alert('Giá trị thời gian không hợp lệ!');
  }
};

async function clearAllSync() {
  if (confirm('Bạn có chắc muốn xóa tất cả mốc đồng bộ của file này không?')) {
    state.pageTimestamps = {};
    saveSyncToStorage();
    await autoSaveToDirectoryIfPossible();
    updatePageTimestampBadge();
    renderSyncTable();
  }
}

function exportSyncData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.pageTimestamps, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", getSyncFileName());
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importSyncData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (typeof imported === 'object') {
        state.pageTimestamps = imported;
        saveSyncToStorage();
        await autoSaveToDirectoryIfPossible();
        updatePageTimestampBadge();
        renderSyncTable();
        showToast('🎉 Nhập mốc thời gian thành công!');
      }
    } catch (err) {
      alert('File JSON không hợp lệ!');
    }
  };
  reader.readAsText(file);
}

function initTouchGestures() {
  let touchStartX = 0;
  let touchEndX = 0;

  dom.viewerContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  dom.viewerContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const threshold = 60;
    if (touchEndX < touchStartX - threshold) {
      changePage(1);
    }
    if (touchEndX > touchStartX + threshold) {
      changePage(-1);
    }
  }, { passive: true });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

document.addEventListener('DOMContentLoaded', initEvents);
