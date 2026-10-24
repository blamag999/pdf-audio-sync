// Ứng dụng đọc PDF và đồng bộ Audio theo từng trang (PDF Audio Sync)

// STATE CHÍNH CỦA ỨNG DỤNG
const state = {
  pdfDoc: null,
  pageNum: 1,
  totalPages: 0,
  pageRendering: false,
  pageNumPending: null,
  pdfFileName: '',
  audioFileName: '',
  // Mảng hoặc object lưu mốc thời gian: { [pageNumber]: timestampInSeconds }
  pageTimestamps: {},
  autoPageTurn: true,
  autoSeekAudio: true,
  isAudioDrivenChange: false, // Flag để tránh lặp vô tận khi audio chuyển trang rồi trang lại tua audio
  speeds: [0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
  speedIndex: 1
};

// DOM ELEMENTS
const dom = {
  pdfFileInput: document.getElementById('pdfFileInput'),
  audioFileInput: document.getElementById('audioFileInput'),
  pdfFileName: document.getElementById('pdfFileName'),
  audioFileName: document.getElementById('audioFileName'),
  filePickerSection: document.getElementById('filePickerSection'),
  btnToggleSettings: document.getElementById('btnToggleSettings'),

  viewerContainer: document.getElementById('viewerContainer'),
  emptyState: document.getElementById('emptyState'),
  canvasWrapper: document.getElementById('canvasWrapper'),
  pdfCanvas: document.getElementById('pdfCanvas'),
  pdfLoadingIndicator: document.getElementById('pdfLoadingIndicator'),

  lblCurrentPage: document.getElementById('lblCurrentPage'),
  lblTotalPages: document.getElementById('lblTotalPages'),
  lblPageTimestamp: document.getElementById('lblPageTimestamp'),
  btnPinCurrentTime: document.getElementById('btnPinCurrentTime'),

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
  btnClearSync: document.getElementById('btnClearSync')
};

// ĐỊNH DẠNG GIÂY THÀNH MM:SS HOẶC HH:MM:SS
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

// KHỞI TẠO CÁC SỰ KIỆN
function initEvents() {
  // Chọn file PDF
  dom.pdfFileInput.addEventListener('change', handlePdfFileSelect);

  // Chọn file Audio MP3
  dom.audioFileInput.addEventListener('change', handleAudioFileSelect);

  // Toggle ẩn hiện phần chọn file
  dom.btnToggleSettings.addEventListener('click', () => {
    dom.filePickerSection.classList.toggle('collapsed');
  });

  // Tùy chọn tự động
  dom.chkAutoPageTurn.addEventListener('change', (e) => {
    state.autoPageTurn = e.target.checked;
  });
  dom.chkAutoSeekAudio.addEventListener('change', (e) => {
    state.autoSeekAudio = e.target.checked;
  });

  // Điều khiển lật trang
  dom.btnPrevPage.addEventListener('click', () => changePage(-1));
  dom.btnNextPage.addEventListener('click', () => changePage(1));

  // Ghim mốc thời gian cho trang hiện tại
  dom.btnPinCurrentTime.addEventListener('click', pinCurrentTimeToPage);

  // Audio Play/Pause
  dom.btnPlayPause.addEventListener('click', togglePlayPause);

  // Tua 5s
  dom.btnRewind5.addEventListener('click', () => {
    dom.audioElement.currentTime = Math.max(0, dom.audioElement.currentTime - 5);
  });
  dom.btnForward5.addEventListener('click', () => {
    dom.audioElement.currentTime = Math.min(dom.audioElement.duration || 0, dom.audioElement.currentTime + 5);
  });

  // Chỉnh tốc độ
  dom.btnSpeed.addEventListener('click', cycleSpeed);

  // Audio sự kiện timeupdate & seeker
  dom.audioElement.addEventListener('timeupdate', onAudioTimeUpdate);
  dom.audioElement.addEventListener('loadedmetadata', onAudioMetadataLoaded);
  dom.audioElement.addEventListener('play', () => { dom.btnPlayPause.textContent = '⏸'; });
  dom.audioElement.addEventListener('pause', () => { dom.btnPlayPause.textContent = '▶'; });

  dom.audioSeeker.addEventListener('input', (e) => {
    dom.audioElement.currentTime = parseFloat(e.target.value);
  });

  // Modal đồng bộ
  dom.btnOpenSyncModal.addEventListener('click', openSyncModal);
  dom.btnCloseSyncModal.addEventListener('click', () => dom.syncModal.classList.add('hidden'));
  dom.syncModal.addEventListener('click', (e) => {
    if (e.target === dom.syncModal) dom.syncModal.classList.add('hidden');
  });

  // Xuất & Nhập mốc
  dom.btnExportSync.addEventListener('click', exportSyncData);
  dom.importSyncInput.addEventListener('change', importSyncData);
  dom.btnClearSync.addEventListener('click', clearAllSync);

  // Thao tác vuốt màn hình (Swipe gesture) trên điện thoại để lật trang
  initTouchGestures();

  // Resize màn hình tự vẽ lại kích thước PDF
  window.addEventListener('resize', debounce(() => {
    if (state.pdfDoc) renderPage(state.pageNum);
  }, 300));
}

// XỬ LÝ CHỌN FILE PDF
async function handlePdfFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  state.pdfFileName = file.name;
  dom.pdfFileName.textContent = file.name;
  dom.pdfLoadingIndicator.classList.remove('hidden');

  try {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result);
      state.pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
      state.totalPages = state.pdfDoc.numPages;
      state.pageNum = 1;

      dom.lblTotalPages.textContent = state.totalPages;
      dom.emptyState.classList.add('hidden');
      dom.canvasWrapper.classList.remove('hidden');
      dom.pdfLoadingIndicator.classList.add('hidden');

      // Tự động load dữ liệu mốc đã lưu trước đó nếu có
      loadSyncFromStorage();

      renderPage(state.pageNum);
    };
    fileReader.readAsArrayBuffer(file);
  } catch (error) {
    alert('Không thể mở file PDF: ' + error.message);
    dom.pdfLoadingIndicator.classList.add('hidden');
  }
}

// XỬ LÝ CHỌN FILE MP3
function handleAudioFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  state.audioFileName = file.name;
  dom.audioFileName.textContent = file.name;

  const objectUrl = URL.createObjectURL(file);
  dom.audioElement.src = objectUrl;
  dom.audioElement.load();
}

// VẼ TRANG PDF
function renderPage(num) {
  if (!state.pdfDoc) return;
  state.pageRendering = true;

  state.pdfDoc.getPage(num).then(page => {
    const canvas = dom.pdfCanvas;
    const ctx = canvas.getContext('2d');

    // Tính tỉ lệ phóng to sao cho vừa khít chiều rộng màn hình thiết bị
    const containerWidth = dom.viewerContainer.clientWidth - 28;
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, containerWidth / unscaledViewport.width);
    const viewport = page.getViewport({ scale: Math.max(scale, 0.8) });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    const renderTask = page.render(renderContext);
    renderTask.promise.then(() => {
      state.pageRendering = false;
      if (state.pageNumPending !== null) {
        renderPage(state.pageNumPending);
        state.pageNumPending = null;
      }
    });
  });

  // Cập nhật nhãn trang hiện tại
  dom.lblCurrentPage.textContent = num;
  updatePageTimestampBadge();

  // Nếu lật trang thủ công và bật "Lật trang tự tua audio"
  if (state.autoSeekAudio && !state.isAudioDrivenChange) {
    const targetTimestamp = state.pageTimestamps[num];
    if (typeof targetTimestamp === 'number') {
      dom.audioElement.currentTime = targetTimestamp;
    }
  }
}

function queueRenderPage(num) {
  if (state.pageRendering) {
    state.pageNumPending = num;
  } else {
    renderPage(num);
  }
}

// ĐỔI TRANG
function changePage(delta) {
  if (!state.pdfDoc) return;
  const newPage = state.pageNum + delta;
  if (newPage >= 1 && newPage <= state.totalPages) {
    state.pageNum = newPage;
    state.isAudioDrivenChange = false;
    queueRenderPage(state.pageNum);
  }
}

// CẬP NHẬT NHÃN MỐC THỜI GIAN TRANG HIỆN TẠI
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

// GHIM MỐC THỜI GIAN HIỆN TẠI VÀO TRANG ĐANG XEM
function pinCurrentTimeToPage() {
  if (!state.pdfDoc) {
    alert('Vui lòng chọn file PDF trước!');
    return;
  }
  const currentTime = dom.audioElement.currentTime || 0;
  state.pageTimestamps[state.pageNum] = Math.round(currentTime * 10) / 10;

  saveSyncToStorage();
  updatePageTimestampBadge();

  // Hiệu ứng phản hồi nhẹ
  const originalText = dom.btnPinCurrentTime.textContent;
  dom.btnPinCurrentTime.textContent = `Đã ghim: ${formatTime(currentTime)}!`;
  dom.btnPinCurrentTime.style.backgroundColor = '#10b981';
  setTimeout(() => {
    dom.btnPinCurrentTime.textContent = originalText;
    dom.btnPinCurrentTime.style.backgroundColor = '';
  }, 1200);
}

// PLAY / PAUSE
function togglePlayPause() {
  if (!dom.audioElement.src) {
    alert('Vui lòng chọn file MP3 trước!');
    return;
  }
  if (dom.audioElement.paused) {
    dom.audioElement.play();
  } else {
    dom.audioElement.pause();
  }
}

// THAY ĐỔI TỐC ĐỘ ĐỌC
function cycleSpeed() {
  state.speedIndex = (state.speedIndex + 1) % state.speeds.length;
  const newSpeed = state.speeds[state.speedIndex];
  dom.audioElement.playbackRate = newSpeed;
  dom.btnSpeed.textContent = `${newSpeed}x`;
}

// KHI AUDIO TẢI XONG THÔNG TIN
function onAudioMetadataLoaded() {
  const duration = dom.audioElement.duration || 0;
  dom.audioSeeker.max = duration;
  dom.lblAudioDuration.textContent = formatTime(duration);
}

// KHI AUDIO ĐANG CHẠY (TIMEUPDATE)
function onAudioTimeUpdate() {
  const curr = dom.audioElement.currentTime;
  dom.audioSeeker.value = curr;
  dom.lblAudioCurrentTime.textContent = formatTime(curr);

  // TÍNH NĂNG TỰ ĐỘNG CHUYỂN TRANG THEO MỐC ÂM THANH
  if (state.autoPageTurn && state.pdfDoc && Object.keys(state.pageTimestamps).length > 0) {
    // Tìm trang có timestamp lớn nhất nhưng vẫn <= thời điểm hiện tại
    let matchedPage = null;
    let maxTime = -1;

    for (const [pageStr, timestamp] of Object.entries(state.pageTimestamps)) {
      const pageNum = parseInt(pageStr, 10);
      if (curr >= timestamp && timestamp > maxTime) {
        maxTime = timestamp;
        matchedPage = pageNum;
      }
    }

    if (matchedPage && matchedPage !== state.pageNum) {
      state.isAudioDrivenChange = true;
      state.pageNum = matchedPage;
      queueRenderPage(matchedPage);
      setTimeout(() => { state.isAudioDrivenChange = false; }, 300);
    }
  }
}

// QUẢN LÝ LOCALSTORAGE (TỰ LƯU MỐC THEO TÊN FILE PDF)
function getStorageKey() {
  return `pdf_sync_${state.pdfFileName || 'default'}`;
}

function saveSyncToStorage() {
  if (!state.pdfFileName) return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state.pageTimestamps));
  } catch (e) {
    console.error('Không thể lưu vào localStorage', e);
  }
}

function loadSyncFromStorage() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      state.pageTimestamps = JSON.parse(raw);
    } else {
      state.pageTimestamps = {};
    }
  } catch (e) {
    state.pageTimestamps = {};
  }
}

// MODAL QUẢN LÝ MỐC ĐỒNG BỘ
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

// HÀM TOÀN CỤC CHO MODAL
window.seekAndPlayTo = function(seconds, page) {
  dom.audioElement.currentTime = seconds;
  dom.audioElement.play();
  state.pageNum = page;
  queueRenderPage(page);
  dom.syncModal.classList.add('hidden');
};

window.deleteSync = function(page) {
  delete state.pageTimestamps[page];
  saveSyncToStorage();
  updatePageTimestampBadge();
  renderSyncTable();
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
    renderSyncTable();
  } else {
    alert('Giá trị thời gian không hợp lệ!');
  }
};

function clearAllSync() {
  if (confirm('Bạn có chắc muốn xóa tất cả mốc đồng bộ của file này không?')) {
    state.pageTimestamps = {};
    saveSyncToStorage();
    updatePageTimestampBadge();
    renderSyncTable();
  }
}

// XUẤT FILE JSON MỐC ĐỒNG BỘ
function exportSyncData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.pageTimestamps, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  const baseName = state.pdfFileName ? state.pdfFileName.replace(/\.[^/.]+$/, "") : "pdf_audio";
  downloadAnchor.setAttribute("download", `${baseName}_sync.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// NHẬP FILE JSON MỐC ĐỒNG BỘ
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
        renderSyncTable();
        alert('Nhập mốc thời gian thành công!');
      }
    } catch (err) {
      alert('File JSON không hợp lệ!');
    }
  };
  reader.readAsText(file);
}

// VUỐT TRÊN MÀN HÌNH ĐIỆN THOẠI (SWIPE GESTURE)
function initTouchGestures() {
  let touchStartX = 0;
  let touchEndX = 0;

  dom.viewerContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  dom.viewerContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const threshold = 60; // Ngưỡng vuốt
    if (touchEndX < touchStartX - threshold) {
      // Vuốt sang trái -> Trang sau
      changePage(1);
    }
    if (touchEndX > touchStartX + threshold) {
      // Vuốt sang phải -> Trang trước
      changePage(-1);
    }
  }
}

// TIỆN ÍCH DEBOUNCE
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// KHỞI CHẠY ỨNG DỤNG
document.addEventListener('DOMContentLoaded', initEvents);
