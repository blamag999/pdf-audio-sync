// Ứng dụng đọc PDF và đồng bộ Audio theo từng trang (PDF Audio Sync v5.0 - Playlist Chọn Nhanh Tập Truyện)

// STATE CHÍNH CỦA ỨNG DỤNG
const state = {
  pdfDoc: null,
  pageNum: 1,
  totalPages: 0,
  pageRendering: false,
  pageNumPending: null,
  pdfFileName: '',
  audioFileName: '',
  currentBookKey: '',

  // DANH SÁCH TẬP TRUYỆN (PLAYLIST)
  playlist: [], // [ { id, title, pdf, audios, json } ]
  currentStoryIndex: -1,
  activeFilter: 'all',
  searchQuery: '',

  // Mốc thời gian: { [pageNumber]: timestampInSeconds }
  pageTimestamps: {},
  autoPageTurn: true,
  autoSeekAudio: true,
  isAudioDrivenChange: false,

  // CHẾ ĐỘ HIỂN THỊ
  viewMode: 'fit-width',
  zoomScale: 1.0,

  speeds: [0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
  speedIndex: 1
};

// =======================================================
// INDEXEDDB THƯ VIỆN SÁCH
// =======================================================
const DB_NAME = 'PdfAudioSyncDB';
const DB_STORE = 'book_library';
let dbInstance = null;

function initIndexedDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    request.onerror = () => resolve(null);
  });
}

function getFileStem(filename) {
  if (!filename) return '';
  return filename.replace(/\.[^/.]+$/, "").trim().toLowerCase();
}

// Chuẩn hóa tên truyện để tự động ghép đôi PDF và MP3
function normalizeStoryTitle(filename) {
  if (!filename) return '';
  return filename
    .replace(/\.[^/.]+$/, "") // bỏ phần mở rộng .pdf / .mp3
    .replace(/^[xX]22/g, "") // bỏ ký tự thừa Google Drive x22
    .replace(/[_\-]+/g, " ") // đổi dấu gạch ngang/dưới thành dấu cách
    .replace(/\bread[\s_-]*along\b/gi, "") // bỏ từ read along
    .replace(/\bbook\b/gi, "")
    .replace(/\bside[\s_-]*[0-9]+\b/gi, "") // bỏ side 1, side 2
    .replace(/\bpart[\s_-]*[0-9]+\b/gi, "")
    .replace(/[,\.]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function saveBookToLibrary(bookData) {
  if (!dbInstance) await initIndexedDB();
  if (!dbInstance || !bookData.id) return;

  try {
    const tx = dbInstance.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const getReq = store.get(bookData.id);
    getReq.onsuccess = () => {
      const existing = getReq.result || {};
      const merged = {
        id: bookData.id,
        pdfName: bookData.pdfName || existing.pdfName || '',
        pdfBlob: bookData.pdfBlob || existing.pdfBlob || null,
        audioName: bookData.audioName || existing.audioName || '',
        audioBlob: bookData.audioBlob || existing.audioBlob || null,
        timestamps: bookData.timestamps || existing.timestamps || {},
        updatedAt: Date.now()
      };
      store.put(merged);
    };
  } catch (err) {}
}

async function getBookFromLibrary(key) {
  if (!dbInstance) await initIndexedDB();
  if (!dbInstance || !key) return null;

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

  btnOpenPlaylist: document.getElementById('btnOpenPlaylist'),
  lblPlaylistCount: document.getElementById('lblPlaylistCount'),
  playlistModal: document.getElementById('playlistModal'),
  btnClosePlaylist: document.getElementById('btnClosePlaylist'),
  lblPlaylistSubtitle: document.getElementById('lblPlaylistSubtitle'),
  txtPlaylistSearch: document.getElementById('txtPlaylistSearch'),
  playlistItemsList: document.getElementById('playlistItemsList'),
  playlistLoading: document.getElementById('playlistLoading'),

  btnNode1FolderOnline: document.getElementById('btnNode1FolderOnline'),
  folderInput: document.getElementById('folderInput'),
  pdfFileInput: document.getElementById('pdfFileInput'),
  audioFileInput: document.getElementById('audioFileInput'),

  node1Modal: document.getElementById('node1Modal'),
  btnCloseNode1Modal: document.getElementById('btnCloseNode1Modal'),
  btnTriggerFolderPicker: document.getElementById('btnTriggerFolderPicker'),
  txtOnlineFolder: document.getElementById('txtOnlineFolder'),
  txtOnlineAudio: document.getElementById('txtOnlineAudio'),
  btnLoadOnlineLinks: document.getElementById('btnLoadOnlineLinks'),
  onlineHistorySection: document.getElementById('onlineHistorySection'),
  onlineHistoryList: document.getElementById('onlineHistoryList'),

  pdfFileName: document.getElementById('pdfFileName'),
  audioFileName: document.getElementById('audioFileName'),
  syncCountBadge: document.getElementById('syncCountBadge'),

  filePickerSection: document.getElementById('filePickerSection'),
  btnToggleSettings: document.getElementById('btnToggleSettings'),

  cardGuideFolder: document.getElementById('cardGuideFolder'),
  cardGuidePdf: document.getElementById('cardGuidePdf'),
  cardGuideAudio: document.getElementById('cardGuideAudio'),

  viewerContainer: document.getElementById('viewerContainer'),
  dropOverlay: document.getElementById('dropOverlay'),
  emptyState: document.getElementById('emptyState'),
  canvasWrapper: document.getElementById('canvasWrapper'),
  pageLeftWrapper: document.getElementById('pageLeftWrapper'),
  pageRightWrapper: document.getElementById('pageRightWrapper'),
  pdfCanvasLeft: document.getElementById('pdfCanvasLeft'),
  pdfCanvasRight: document.getElementById('pdfCanvasRight'),
  pdfLoadingIndicator: document.getElementById('pdfLoadingIndicator'),
  lblLoadingText: document.getElementById('lblLoadingText'),

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

function showToast(msg) {
  dom.toastMessage.textContent = msg;
  dom.toastMessage.classList.remove('hidden');
  setTimeout(() => {
    dom.toastMessage.classList.add('hidden');
  }, 3500);
}

function updateSyncCountBadge() {
  const count = Object.keys(state.pageTimestamps).length;
  dom.syncCountBadge.textContent = `⏱️ ${count} mốc`;
  if (count > 0) {
    dom.syncCountBadge.classList.remove('empty');
  } else {
    dom.syncCountBadge.classList.add('empty');
  }
}

function resetSyncForNewDocument(newDocName) {
  state.pageTimestamps = {};
  state.pageNum = 1;

  if (dom.audioElement) {
    dom.audioElement.pause();
    dom.audioElement.currentTime = 0;
  }
  if (dom.audioSeeker) dom.audioSeeker.value = 0;
  if (dom.lblAudioCurrentTime) dom.lblAudioCurrentTime.textContent = '00:00';

  dom.lblCurrentPage.textContent = '1';
  dom.lblPageTimestamp.textContent = 'Mốc: Chưa gán';
  dom.lblPageTimestamp.style.color = '#94a3b8';
  updateSaveStatusBadge('💾 Mới (Chưa có mốc)');
  updateSyncCountBadge();

  if (newDocName) {
    const key = `pdf_sync_${newDocName}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          state.pageTimestamps = parsed;
          updateSaveStatusBadge('💾 Đã khôi phục mốc cũ');
        }
      }
    } catch (e) {
      state.pageTimestamps = {};
    }
  }

  updatePageTimestampBadge();
  updateSyncCountBadge();
}

// =======================================================
// XÂY DỰNG VÀ QUẢN LÝ DANH SÁCH TẬP TRUYỆN (PLAYLIST)
// =======================================================
function buildPlaylistFromItems(rawItems) {
  // rawItems: mảng các { name, blob, id, url, type: 'pdf'|'audio'|'json' }
  const groups = {};

  rawItems.forEach(item => {
    const norm = normalizeStoryTitle(item.name);
    const key = norm.toLowerCase();

    if (!groups[key]) {
      groups[key] = {
        id: key,
        title: norm.charAt(0).toUpperCase() + norm.slice(1),
        pdf: null,
        audios: [],
        json: null
      };
    }

    if (item.type === 'pdf') {
      groups[key].pdf = item;
    } else if (item.type === 'audio') {
      groups[key].audios.push(item);
    } else if (item.type === 'json') {
      groups[key].json = item;
    }
  });

  const playlistArray = Object.values(groups);
  // Sắp xếp theo tên truyện A-Z
  playlistArray.sort((a, b) => a.title.localeCompare(b.title, 'vi', { numeric: true }));

  state.playlist = playlistArray;
  updatePlaylistBadgeCount();
  renderPlaylistView();

  if (playlistArray.length > 0) {
    dom.lblPlaylistSubtitle = document.getElementById('lblPlaylistSubtitle');
    if (dom.lblPlaylistSubtitle) {
      dom.lblPlaylistSubtitle.textContent = `Tìm thấy ${playlistArray.length} tập truyện trong thư mục`;
    }
    // Mở popup danh sách truyện cho người dùng chọn nhanh
    dom.playlistModal.classList.remove('hidden');
    showToast(`📚 Đã nạp danh sách ${playlistArray.length} tập truyện!`);
  }
}

function updatePlaylistBadgeCount() {
  const count = state.playlist.length;
  if (count > 0) {
    dom.lblPlaylistCount.textContent = count;
    dom.lblPlaylistCount.classList.remove('hidden');
  } else {
    dom.lblPlaylistCount.classList.add('hidden');
  }
}

function renderPlaylistView() {
  dom.playlistItemsList.innerHTML = '';
  const query = state.searchQuery.toLowerCase().trim();
  const filter = state.activeFilter;

  const filtered = state.playlist.filter(story => {
    // 1. Lọc theo từ khóa tìm kiếm
    const matchQuery = !query || story.title.toLowerCase().includes(query) ||
      (story.pdf && story.pdf.name.toLowerCase().includes(query)) ||
      (story.audios.some(a => a.name.toLowerCase().includes(query)));

    if (!matchQuery) return false;

    // 2. Lọc theo tab
    if (filter === 'paired') return story.pdf && story.audios.length > 0;
    if (filter === 'pdf') return !!story.pdf;
    if (filter === 'mp3') return story.audios.length > 0;
    return true;
  });

  if (filtered.length === 0) {
    dom.playlistItemsList.innerHTML = `
      <div style="text-align:center; padding: 30px; color: #94a3b8;">
        Không tìm thấy tập truyện nào phù hợp!
      </div>
    `;
    return;
  }

  filtered.forEach((story, idx) => {
    const card = document.createElement('div');
    const isPlaying = (state.currentBookKey === story.id);
    card.className = `playlist-card ${isPlaying ? 'active-playing' : ''}`;

    let tagsHtml = '';
    if (story.pdf) {
      tagsHtml += `<span class="mini-badge badge-pdf">📄 ${story.pdf.name}</span>`;
    }
    if (story.audios && story.audios.length > 0) {
      story.audios.forEach((aud, aIdx) => {
        tagsHtml += `<span class="mini-badge badge-mp3">🎵 ${aud.name}</span>`;
      });
    }

    card.innerHTML = `
      <div class="card-title-col">
        <h4>${isPlaying ? '▶ ' : ''}${story.title}</h4>
        <div class="card-tags">${tagsHtml}</div>
      </div>
      <button class="card-play-btn">
        ${isPlaying ? 'Đang đọc' : '▶ Mở tập này'}
      </button>
    `;

    card.addEventListener('click', () => {
      loadStoryFromPlaylist(story);
      dom.playlistModal.classList.add('hidden');
    });

    dom.playlistItemsList.appendChild(card);
  });
}

// MỞ TRUYỆN TỪ PLAYLIST (TỰ ĐỘNG NẠP CẢ PDF VÀ MP3)
async function loadStoryFromPlaylist(story) {
  state.currentBookKey = story.id;

  // 1. Nạp file PDF
  if (story.pdf) {
    if (story.pdf.blob) {
      await loadPdfFromBlob(story.pdf.blob);
    } else if (story.pdf.url) {
      await loadPdfFromUrl(story.pdf.url);
    }
  }

  // 2. Nạp file MP3 (nếu có)
  if (story.audios && story.audios.length > 0) {
    const primaryAudio = story.audios[0];
    if (primaryAudio.blob) {
      loadAudioFromBlob(primaryAudio.blob);
    } else if (primaryAudio.url) {
      loadAudioFromUrl(primaryAudio.url);
    }
  }

  // 3. Nạp file mốc JSON (nếu có)
  if (story.json && story.json.blob) {
    try {
      const text = await story.json.blob.text();
      state.pageTimestamps = JSON.parse(text);
      saveSyncToStorage();
      updatePageTimestampBadge();
      updateSyncCountBadge();
    } catch (e) {}
  }

  showToast(`📖 Đang mở: ${story.title}`);
  renderPlaylistView();
}

// =======================================================
// QUÉT THƯ MỤC GOOGLE DRIVE VÀ TỰ TRÍCH XUẤT TOÀN BỘ FILE
// =======================================================
async function parseGoogleDriveFolderUrl(folderUrl) {
  dom.lblLoadingText.textContent = 'Đang quét toàn bộ danh sách truyện trên Google Drive...';
  dom.pdfLoadingIndicator.classList.remove('hidden');

  try {
    let html = null;
    // 1. Thử qua CORS Proxy 1
    try {
      const pUrl = `https://corsproxy.io/?${encodeURIComponent(folderUrl)}`;
      const res = await fetch(pUrl);
      if (res.ok) html = await res.text();
    } catch (e) {}

    // 2. Fallback qua CORS Proxy 2
    if (!html) {
      const pUrl2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(folderUrl)}`;
      const res2 = await fetch(pUrl2);
      if (res2.ok) html = await res2.text();
    }

    if (!html) {
      throw new Error('Không thể kết nối đến máy chủ Google Drive');
    }

    // REGEX QUÉT TOÀN BỘ FILE TRONG HTML GOOGLE DRIVE
    const pattern = /aria-label="([^"]+?\.(?:pdf|mp3|m4a|wav|aac|json))[^"]*"[^>]*?ssk=['"]5:[^:]+:([a-zA-Z0-9_-]{20,})/gi;
    const items = [];
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const filename = match[1];
      const fileId = match[2];
      const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

      const lower = filename.toLowerCase();
      let type = 'unknown';
      if (lower.endsWith('.pdf')) type = 'pdf';
      else if (lower.endsWith('.mp3') || lower.endsWith('.m4a') || lower.endsWith('.wav')) type = 'audio';
      else if (lower.endsWith('.json')) type = 'json';

      if (type !== 'unknown') {
        items.push({
          name: filename,
          id: fileId,
          url: directUrl,
          type: type
        });
      }
    }

    dom.pdfLoadingIndicator.classList.add('hidden');

    if (items.length > 0) {
      buildPlaylistFromItems(items);
      showToast(`🎉 Đã quét được ${items.length} file trong thư mục Google Drive!`);
      // Mở ngay truyện đầu tiên
      if (state.playlist.length > 0) {
        loadStoryFromPlaylist(state.playlist[0]);
      }
      return true;
    } else {
      alert('Không tìm thấy file nào trong thư mục Google Drive này. Hãy đảm bảo thư mục được chia sẻ ở chế độ "Bất kỳ ai có đường liên kết đều có thể xem"!');
      return false;
    }

  } catch (err) {
    dom.pdfLoadingIndicator.classList.add('hidden');
    alert('Lỗi quét thư mục Google Drive: ' + err.message);
    return false;
  }
}

// =======================================================
// SỰ KIỆN GIAO DIỆN
// =======================================================
function initEvents() {
  initIndexedDB();

  // Nút mở Playlist
  dom.btnOpenPlaylist.addEventListener('click', () => {
    if (state.playlist.length === 0) {
      alert('Chưa có danh sách truyện. Vui lòng bấm Nút 1 để chọn thư mục trên máy hoặc dán link Google Drive!');
      return;
    }
    dom.playlistModal.classList.remove('hidden');
  });

  dom.btnClosePlaylist.addEventListener('click', () => dom.playlistModal.classList.add('hidden'));
  dom.playlistModal.addEventListener('click', (e) => {
    if (e.target === dom.playlistModal) dom.playlistModal.classList.add('hidden');
  });

  // Tìm kiếm trong Playlist
  dom.txtPlaylistSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderPlaylistView();
  });

  // Lọc tab trong Playlist
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeFilter = e.target.getAttribute('data-filter');
      renderPlaylistView();
    });
  });

  // NÚT 1: THƯ MỤC / DRIVE
  dom.btnNode1FolderOnline.addEventListener('click', () => {
    renderOnlineHistory();
    dom.node1Modal.classList.remove('hidden');
  });
  dom.btnCloseNode1Modal.addEventListener('click', () => dom.node1Modal.classList.add('hidden'));
  dom.node1Modal.addEventListener('click', (e) => {
    if (e.target === dom.node1Modal) dom.node1Modal.classList.add('hidden');
  });

  dom.btnTriggerFolderPicker.addEventListener('click', () => {
    dom.node1Modal.classList.add('hidden');
    handleFolderPick();
  });
  dom.folderInput.addEventListener('change', (e) => handleFileList(Array.from(e.target.files)));
  dom.btnLoadOnlineLinks.addEventListener('click', handleLoadOnlineSubmit);

  // NÚT 2: CHỌN PDF
  dom.pdfFileInput.addEventListener('change', handlePdfFileSelect);

  // NÚT 3: CHỌN MP3
  dom.audioFileInput.addEventListener('change', handleAudioFileSelect);

  dom.cardGuideFolder.addEventListener('click', () => dom.btnNode1FolderOnline.click());
  dom.cardGuidePdf.addEventListener('click', () => dom.pdfFileInput.click());
  dom.cardGuideAudio.addEventListener('click', () => dom.audioFileInput.click());

  // View controls
  dom.btnFitWidth.addEventListener('click', () => setViewMode('fit-width'));
  dom.btnFitHeight.addEventListener('click', () => setViewMode('fit-height'));
  dom.btnTwoPages.addEventListener('click', () => setViewMode('two-pages'));
  dom.btnZoomIn.addEventListener('click', () => changeZoom(0.15));
  dom.btnZoomOut.addEventListener('click', () => changeZoom(-0.15));

  initDragAndDrop();

  dom.btnToggleSettings.addEventListener('click', () => {
    dom.filePickerSection.classList.toggle('collapsed');
  });

  dom.chkAutoPageTurn.addEventListener('change', (e) => { state.autoPageTurn = e.target.checked; });
  dom.chkAutoSeekAudio.addEventListener('change', (e) => { state.autoSeekAudio = e.target.checked; });

  dom.btnPrevPage.addEventListener('click', () => changePage(-1));
  dom.btnNextPage.addEventListener('click', () => changePage(1));

  dom.btnPinCurrentTime.addEventListener('click', pinCurrentTimeToPage);
  dom.btnSaveToFolder.addEventListener('click', saveSyncToDirectoryOrDownload);

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
// XỬ LÝ CHỌN FILE LẺ NÚT 2 & 3
// =======================================================
async function handlePdfFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const stem = getFileStem(file.name);
  state.currentBookKey = stem;

  await loadPdfFromBlob(file);

  const saved = await getBookFromLibrary(stem);
  if (saved) {
    if (saved.audioBlob) {
      loadAudioFromBlob(saved.audioBlob);
      showToast(`⚡ Đã tự động nạp MP3: ${saved.audioName}`);
    }
    if (saved.timestamps && Object.keys(saved.timestamps).length > 0) {
      state.pageTimestamps = saved.timestamps;
      saveSyncToStorage();
      updatePageTimestampBadge();
      updateSyncCountBadge();
      showToast(`⚡ Đã tự động mở toàn bộ MP3 & ${Object.keys(saved.timestamps).length} mốc thời gian!`);
    }
  }

  saveBookToLibrary({
    id: stem,
    pdfName: file.name,
    pdfBlob: file,
    timestamps: state.pageTimestamps
  });
}

async function handleAudioFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const stem = getFileStem(file.name);
  loadAudioFromBlob(file);

  if (!state.pdfDoc) {
    const saved = await getBookFromLibrary(stem);
    if (saved) {
      if (saved.pdfBlob) {
        state.currentBookKey = stem;
        await loadPdfFromBlob(saved.pdfBlob);
        showToast(`⚡ Đã tự động mở PDF: ${saved.pdfName}`);
      }
      if (saved.timestamps && Object.keys(saved.timestamps).length > 0) {
        state.pageTimestamps = saved.timestamps;
        saveSyncToStorage();
        updatePageTimestampBadge();
        updateSyncCountBadge();
        showToast(`⚡ Đã tự động mở toàn bộ PDF & ${Object.keys(saved.timestamps).length} mốc thời gian!`);
      }
    }
  }

  const key = state.currentBookKey || stem;
  saveBookToLibrary({
    id: key,
    audioName: file.name,
    audioBlob: file,
    timestamps: state.pageTimestamps
  });
}

// =======================================================
// XỬ LÝ NÚT 1: CHỌN THƯ MỤC TRÊN MÁY
// =======================================================
async function handleFolderPick() {
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const files = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          files.push(file);
        }
      }
      handleFileList(files);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  dom.folderInput.click();
}

function handleFileList(files) {
  if (!files || files.length === 0) return;

  const rawItems = [];
  files.forEach(f => {
    const l = f.name.toLowerCase();
    let type = 'unknown';
    if (l.endsWith('.pdf')) type = 'pdf';
    else if (l.endsWith('.mp3') || l.endsWith('.m4a') || l.endsWith('.wav') || l.endsWith('.ogg')) type = 'audio';
    else if (l.endsWith('.json')) type = 'json';

    if (type !== 'unknown') {
      rawItems.push({
        name: f.name,
        blob: f,
        type: type
      });
    }
  });

  if (rawItems.length > 0) {
    buildPlaylistFromItems(rawItems);
    if (state.playlist.length > 0) {
      loadStoryFromPlaylist(state.playlist[0]);
    }
  } else {
    alert('Không tìm thấy file PDF hoặc MP3 nào trong thư mục!');
  }
}

// =======================================================
// XỬ LÝ NÚT 1: DÁN LINK THƯ MỤC HOẶC FILE GOOGLE DRIVE
// =======================================================
async function handleLoadOnlineSubmit() {
  const inputUrl = dom.txtOnlineFolder.value.trim();
  const audioUrl = dom.txtOnlineAudio.value.trim();

  if (!inputUrl && !audioUrl) {
    alert('Vui lòng nhập link thư mục hoặc file Google Drive!');
    return;
  }

  dom.node1Modal.classList.add('hidden');

  // NẾU LÀ LINK THƯ MỤC GOOGLE DRIVE:
  if (inputUrl.includes('/folders/')) {
    saveRecentOnlineLink(inputUrl, '📁 Thư mục Google Drive');
    await parseGoogleDriveFolderUrl(inputUrl);
    return;
  }

  // NẾU LÀ LINK FILE LẺ:
  if (inputUrl) {
    await loadPdfFromUrl(inputUrl);
  }
  if (audioUrl) {
    loadAudioFromUrl(audioUrl);
  }
  saveRecentOnlineLink(inputUrl, audioUrl);
}

function convertGoogleDriveUrl(rawUrl) {
  if (!rawUrl) return '';
  const url = rawUrl.trim();
  let fileId = null;
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match1 && match1[1]) fileId = match1[1];
  else if (match2 && match2[1]) fileId = match2[1];

  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return url;
}

async function loadPdfFromUrl(url) {
  const directUrl = convertGoogleDriveUrl(url);
  dom.lblLoadingText.textContent = 'Đang tải PDF từ Google Drive...';
  dom.pdfLoadingIndicator.classList.remove('hidden');

  try {
    let pdfData = null;
    try {
      const response = await fetch(directUrl);
      if (response.ok) pdfData = await response.arrayBuffer();
    } catch (e) {}

    if (!pdfData) {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;
      const proxyRes = await fetch(proxyUrl);
      if (!proxyRes.ok) throw new Error('Không thể tải qua proxy');
      pdfData = await proxyRes.arrayBuffer();
    }

    const typedarray = new Uint8Array(pdfData);
    state.pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
    state.totalPages = state.pdfDoc.numPages;
    state.pageNum = 1;

    const driveIdMatch = directUrl.match(/id=([a-zA-Z0-9_-]+)/);
    state.pdfFileName = driveIdMatch ? `Drive_PDF_${driveIdMatch[1]}` : 'Online_PDF_Book';
    state.currentBookKey = state.pdfFileName.toLowerCase();
    dom.pdfFileName.textContent = `☁️ PDF Drive (${state.totalPages} trang)`;
    dom.pdfFileName.classList.remove('empty');

    resetSyncForNewDocument(state.pdfFileName);

    dom.lblTotalPages.textContent = state.totalPages;
    dom.emptyState.classList.add('hidden');
    dom.canvasWrapper.classList.remove('hidden');
    dom.pdfLoadingIndicator.classList.add('hidden');

    renderCurrentSpread();
    showToast('🎉 Đã tải PDF từ Google Drive thành công!');
    return true;
  } catch (error) {
    dom.pdfLoadingIndicator.classList.add('hidden');
    alert('Không thể mở file PDF từ link này. Hãy đảm bảo bạn đã bật quyền: "Bất kỳ ai có đường liên kết đều có thể xem" trên Google Drive!\n' + error.message);
    return false;
  }
}

function loadAudioFromUrl(url) {
  const directUrl = convertGoogleDriveUrl(url);
  const driveIdMatch = directUrl.match(/id=([a-zA-Z0-9_-]+)/);
  state.audioFileName = driveIdMatch ? `Drive_Audio_${driveIdMatch[1]}` : 'Online_Audio';
  dom.audioFileName.textContent = `☁️ MP3 Drive Online`;
  dom.audioFileName.classList.remove('empty');

  dom.audioElement.pause();
  dom.audioElement.currentTime = 0;
  if (dom.audioSeeker) dom.audioSeeker.value = 0;
  if (dom.lblAudioCurrentTime) dom.lblAudioCurrentTime.textContent = '00:00';

  dom.audioElement.src = directUrl;
  dom.audioElement.load();
  showToast('🎵 Đã kết nối âm thanh Google Drive!');
}

function saveRecentOnlineLink(url, label) {
  if (!url) return;
  try {
    let history = JSON.parse(localStorage.getItem('pdf_audio_online_history') || '[]');
    history = history.filter(item => item.url !== url);
    history.unshift({
      title: label || `Drive ${new Date().toLocaleDateString('vi-VN')}`,
      url: url,
      time: Date.now()
    });
    history = history.slice(0, 5);
    localStorage.setItem('pdf_audio_online_history', JSON.stringify(history));
  } catch (e) {}
}

function renderOnlineHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('pdf_audio_online_history') || '[]');
    if (history.length === 0) {
      dom.onlineHistorySection.classList.add('hidden');
      return;
    }
    dom.onlineHistorySection.classList.remove('hidden');
    dom.onlineHistoryList.innerHTML = '';

    history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <span class="history-item-title">📖 ${item.title}</span>
        <button class="btn-mini-play">Mở</button>
      `;
      div.addEventListener('click', () => {
        dom.txtOnlineFolder.value = item.url;
        handleLoadOnlineSubmit();
      });
      dom.onlineHistoryList.appendChild(div);
    });
  } catch (e) {}
}

// =======================================================
// RENDER PDF & CHẾ ĐỘ HIỂN THỊ
// =======================================================
async function loadPdfFromBlob(file) {
  state.pdfFileName = file.name;
  dom.pdfFileName.textContent = `📄 ${file.name}`;
  dom.pdfFileName.classList.remove('empty');
  dom.lblLoadingText.textContent = 'Đang tải trang sách...';
  dom.pdfLoadingIndicator.classList.remove('hidden');

  resetSyncForNewDocument(file.name);

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

  dom.audioElement.pause();
  dom.audioElement.currentTime = 0;
  if (dom.audioSeeker) dom.audioSeeker.value = 0;
  if (dom.lblAudioCurrentTime) dom.lblAudioCurrentTime.textContent = '00:00';

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

// =======================================================
// GHIM MỐC THỜI GIAN
// =======================================================
async function pinCurrentTimeToPage() {
  if (!state.pdfDoc) {
    alert('Vui lòng chọn file PDF trước!');
    return;
  }
  const currentTime = dom.audioElement.currentTime || 0;
  state.pageTimestamps[state.pageNum] = Math.round(currentTime * 10) / 10;

  saveSyncToStorage();
  updatePageTimestampBadge();
  updateSyncCountBadge();

  const key = state.currentBookKey || getFileStem(state.pdfFileName);
  if (key) {
    saveBookToLibrary({
      id: key,
      timestamps: state.pageTimestamps
    });
  }

  const originalText = dom.btnPinCurrentTime.textContent;
  dom.btnPinCurrentTime.textContent = `Đã ghim: ${formatTime(currentTime)}!`;
  dom.btnPinCurrentTime.style.backgroundColor = '#10b981';
  setTimeout(() => {
    dom.btnPinCurrentTime.textContent = originalText;
    dom.btnPinCurrentTime.style.backgroundColor = '';
  }, 1200);
}

function getSyncFileName() {
  const baseName = state.pdfFileName ? state.pdfFileName.replace(/\.[^/.]+$/, "") : "pdf_audio";
  return `${baseName}_sync.json`;
}

function saveSyncToDirectoryOrDownload() {
  if (Object.keys(state.pageTimestamps).length === 0) {
    alert('Chưa có mốc thời gian nào để lưu!');
    return;
  }
  exportSyncData();
  showToast(`💾 Đã tải file mốc [${getSyncFileName()}] về máy!`);
}

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

function getStorageKey() {
  return `pdf_sync_${state.pdfFileName || 'default'}`;
}

function saveSyncToStorage() {
  if (!state.pdfFileName) return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state.pageTimestamps));
  } catch (e) {
    console.error(e);
  }
}

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

window.deleteSync = function(page) {
  delete state.pageTimestamps[page];
  saveSyncToStorage();
  updatePageTimestampBadge();
  updateSyncCountBadge();
  renderSyncTable();

  const key = state.currentBookKey || getFileStem(state.pdfFileName);
  if (key) saveBookToLibrary({ id: key, timestamps: state.pageTimestamps });
};

window.setManualSync = function(page) {
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
    updatePageTimestampBadge();
    updateSyncCountBadge();
    renderSyncTable();

    const key = state.currentBookKey || getFileStem(state.pdfFileName);
    if (key) saveBookToLibrary({ id: key, timestamps: state.pageTimestamps });
  } else {
    alert('Giá trị thời gian không hợp lệ!');
  }
};

function clearAllSync() {
  if (confirm('Bạn có chắc muốn xóa tất cả mốc đồng bộ của file này không?')) {
    state.pageTimestamps = {};
    saveSyncToStorage();
    updatePageTimestampBadge();
    updateSyncCountBadge();
    renderSyncTable();

    const key = state.currentBookKey || getFileStem(state.pdfFileName);
    if (key) saveBookToLibrary({ id: key, timestamps: state.pageTimestamps });
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
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (typeof imported === 'object') {
        state.pageTimestamps = imported;
        saveSyncToStorage();
        updatePageTimestampBadge();
        updateSyncCountBadge();
        renderSyncTable();

        const key = state.currentBookKey || getFileStem(state.pdfFileName);
        if (key) saveBookToLibrary({ id: key, timestamps: state.pageTimestamps });

        showToast('🎉 Nhập mốc thời gian thành công!');
      }
    } catch (err) {
      alert('File JSON không hợp lệ!');
    }
  };
  reader.readAsText(file);
}

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
