// Ứng dụng đọc PDF và đồng bộ âm thanh theo từng trang (PDF Audio Sync)

// STATE CHÍNH CỦA ỨNG DỤNG
const state = {
  pdfDoc: null,
  pageNum: 1,
  totalPages: 0,
  pageRendering: false,
  pageNumPending: null,
  pdfFileName: '',
  audioFileName: '',
  currentBookKey: '', // Key định danh duy nhất của cuốn truyện hiện tại
  dirHandle: null, // Thư mục trên máy tính nếu được cấp quyền ghi

  // DANH SÁCH TẬP TRUYỆN (PLAYLIST)
  playlist: [],
  currentStoryIndex: -1,
  activeFilter: 'paired', // Mac dinh chi hien tab co ca PDF & MP3
  searchQuery: '',

  // Mốc thời gian: { [pageNumber]: timestampInSeconds } (CHỈ DÀNH RIÊNG CHO CUỐN HIỆN TẠI)
  pageTimestamps: {},
  pageTurnMode: 'next', // next: tự lật trang theo mốc | markers: dừng chờ người đọc lật trang | off: đọc liên tục
  waitingForManualPageTurn: false,
  pendingManualPage: null,
  resumeAfterManualTurn: false,
  autoSeekAudio: true,
  isAudioDrivenChange: false,

  // CHẾ ĐỘ HIỂN THỊ
  viewMode: 'fit-height',
  zoomScale: 1.0,

  speeds: [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0],
  speedIndex: 2,

  // MULTI-AUDIO STATE
  currentAudioIndex: 0,   // Phần âm thanh đang phát trong currentStoryAudios
  currentStoryAudios: [], // Danh sách các phần âm thanh của truyện đang mở
  pdfSelectionInProgress: false
};

// =======================================================
// INDEXEDDB THƯ VIỆN SÁCH (CÁCH LY DỮ LIỆU TỪNG CUỐN)
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

// Tạo key định danh duy nhất không trùng lặp cho mỗi truyện
function getBookUniqueKey(pdfName, audioName) {
  const name = pdfName || audioName || 'unnamed';
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/^[xX]22/g, "")
    .replace(/[_\-\s,\.]+/g, "_")
    .trim();
}

function normalizeStoryTitle(filename) {
  if (!filename) return '';
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/^[xX]22/g, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\bread[\s_-]*along\b/gi, "")
    .replace(/\bbook\b/gi, "")
    .replace(/\bside[\s_-]*[0-9]+\b/gi, "")
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
        audios: (bookData.audios !== undefined) ? bookData.audios : (existing.audios || []),
        timestamps: (bookData.timestamps !== undefined) ? bookData.timestamps : (existing.timestamps || {}),
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
  btnToggleSettings: document.getElementById('btnToggleSettings'),
  btnChooseAudio: document.getElementById('btnChooseAudio'),
  btnDirectPdfPicker: document.getElementById('btnDirectPdfPicker'),
  folderInput: document.getElementById('folderInput'),
  pdfFileInput: document.getElementById('pdfFileInput'),
  audioFileInput: document.getElementById('audioFileInput'),

  node1Modal: document.getElementById('node1Modal'),
  btnCloseNode1Modal: document.getElementById('btnCloseNode1Modal'),
  btnTriggerFolderPicker: document.getElementById('btnTriggerFolderPicker'),
  btnTriggerPdfPicker: document.getElementById('btnTriggerPdfPicker'),

  pdfFileName: document.getElementById('pdfFileName'),
  audioFileName: document.getElementById('audioFileName'),
  syncCountBadge: document.getElementById('syncCountBadge'),
  syncBanner: document.getElementById('syncBanner'),

  filePickerSection: document.getElementById('filePickerSection'),

  cardGuideFolder: document.getElementById('cardGuideFolder'),
  cardGuidePdf: document.getElementById('cardGuidePdf'),

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
  pageJumpInput: document.getElementById('pageJumpInput'),
  btnPageJump: document.getElementById('btnPageJump'),
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
  playPauseIcon: document.getElementById('playPauseIcon'),
  btnRewind5: document.getElementById('btnRewind5'),
  btnForward5: document.getElementById('btnForward5'),
  speedSelect: document.getElementById('speedSelect'),
  btnReplayPage: document.getElementById('btnReplayPage'),
  selPageTurnMode: document.getElementById('selPageTurnMode'),
  chkAutoSeekAudio: document.getElementById('chkAutoSeekAudio'),

  btnOpenSyncModal: document.getElementById('btnOpenSyncModal'),
  btnCloseSyncModal: document.getElementById('btnCloseSyncModal'),
  syncModal: document.getElementById('syncModal'),
  syncTableBody: document.getElementById('syncTableBody'),
  btnExportSync: document.getElementById('btnExportSync'),
  btnSaveToGithubFolder: document.getElementById('btnSaveToGithubFolder'),
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

// GitHub stores only marker JSON; PDF and audio remain local.
const GITHUB_OWNER='blamag999',GITHUB_REPO='pdf-audio-sync',GITHUB_BRANCH='main',GITHUB_SYNC_DIR='sync_data';
const GITHUB_TOKEN_SESSION_KEY='pdf_audio_sync_github_token';let githubSyncTimer=null;
function getSyncStem(){
  const n = state.pdfFileName || state.currentBookKey || 'truyen';
  return n.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'truyen';
}
function getCloudSyncPath(){return GITHUB_SYNC_DIR+'/'+getSyncStem()+'.json';}
function getGithubToken(){return(sessionStorage.getItem(GITHUB_TOKEN_SESSION_KEY)||'').trim();}
function encodeBase64Utf8(v){const b=new TextEncoder().encode(v);let x='';for(let i=0;i<b.length;i+=0x8000)x+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(x);}
async function syncCurrentBookToGitHub({askForToken=false}={}){
 if(!state.currentBookKey||!state.pdfFileName){if(askForToken)alert('Vui lòng mở PDF trước khi đồng bộ mốc.');return false;}
 let token=getGithubToken();if(!token&&askForToken){token=prompt('Nhập GitHub Personal Access Token có quyền Contents: Read and write cho blamag999/pdf-audio-sync. Token chỉ được giữ trong phiên trình duyệt hiện tại.');if(token){token=token.trim();sessionStorage.setItem(GITHUB_TOKEN_SESSION_KEY,token);}}
 if(!token){if(askForToken)alert('Chưa có GitHub token. Cần quyền Contents: Read and write.');return false;}
 const path=getCloudSyncPath(),url='https://api.github.com/repos/'+GITHUB_OWNER+'/'+GITHUB_REPO+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
 const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
 try{const old=await fetch(url+'?ref='+encodeURIComponent(GITHUB_BRANCH),{headers});let sha=null;if(old.ok)sha=(await old.json()).sha||null;else if(old.status!==404)throw Error('Không đọc được file GitHub ('+old.status+').');
 const body={message:'Sync reading markers for '+getSyncStem(),content:encodeBase64Utf8(JSON.stringify(state.pageTimestamps,null,2)),branch:GITHUB_BRANCH};if(sha)body.sha=sha;
 const res=await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});if(!res.ok)throw Error('GitHub từ chối lưu ('+res.status+'): '+await res.text());
 updateSaveStatusBadge('☁️ Đã đồng bộ GitHub');showToast('☁️ Đã đồng bộ mốc lên GitHub: '+path);return true;
 }catch(e){console.error(e);updateSaveStatusBadge('⚠️ Đồng bộ GitHub lỗi');if(askForToken)alert('Không thể đồng bộ. Kiểm tra token và quyền Contents: Read and write.\\n\\n'+e.message);return false;}
}
function scheduleGitHubSync(){if(!getGithubToken()||!state.currentBookKey)return;if(githubSyncTimer)clearTimeout(githubSyncTimer);githubSyncTimer=setTimeout(()=>{githubSyncTimer=null;syncCurrentBookToGitHub();},900);}
async function loadCloudSyncForBook(){
  const stems=[...new Set([getSyncStem(),state.currentBookKey].filter(Boolean))];
  for(const stem of stems){
    // Ưu tiên tên chuẩn mới, sau đó thử tên cũ có hậu tố _sync.
    for(const filename of [stem+'.json',stem+'_sync.json']){
      try{
        const url='https://raw.githubusercontent.com/'+GITHUB_OWNER+'/'+GITHUB_REPO+'/'+GITHUB_BRANCH+'/'+GITHUB_SYNC_DIR+'/'+encodeURIComponent(filename);
        const res=await fetch(url,{cache:'no-store'});
        if(!res.ok)continue;
        const data=await res.json();
        if(data&&typeof data==='object'&&!Array.isArray(data)){
          state.pageTimestamps=data;saveSyncToStorage();updatePageTimestampBadge();updateSyncCountBadge();
          updateSaveStatusBadge('☁️ Đã nạp mốc từ GitHub');return true;
        }
      }catch(e){console.warn('Không thể nạp mốc GitHub:',e);}
    }
  }
  return false;
}

// =======================================================
// RESET VÀ NẠP MỐC CHUẨN XÁC THEO TỪNG CUỐN (FIX TRIỆT ĐỂ LỖI DỮ LIỆU LẠ)
// =======================================================
async function resetAndLoadSyncForBook(bookKey, attachedJsonBlob) {
  // 1. Luôn xóa sạch toàn bộ mốc của cuốn trước đó khỏi RAM
  state.pageTimestamps = {};
  state.currentBookKey = bookKey;
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

  if (!bookKey) return;

  // 2. THỨ TỰ ƯU TIÊN 1: Nếu có file JSON đi kèm trong thư mục
  if (attachedJsonBlob) {
    try {
      const text = await attachedJsonBlob.text();
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        state.pageTimestamps = parsed;
        saveSyncToStorage();
        updatePageTimestampBadge();
        updateSyncCountBadge();
        updateSaveStatusBadge('💾 Đã nạp từ file .json thư mục');
        return;
      }
    } catch (e) {}
  }

  // 2b. TU DONG TIM JSON SYNC TRONG THU MUC (dirHandle) NEU CHUA CO BLOB
  if (state.dirHandle && bookKey) {
    var jsonNames = [
      bookKey + '_sync.json',
      bookKey + '.json'
    ];
    for (var ji = 0; ji < jsonNames.length; ji++) {
      try {
        var fh = await state.dirHandle.getFileHandle(jsonNames[ji]);
        var djfile = await fh.getFile();
        var djtext = await djfile.text();
        var djparsed = JSON.parse(djtext);
        if (djparsed && typeof djparsed === 'object' && Object.keys(djparsed).length > 0) {
          state.pageTimestamps = djparsed;
          saveSyncToStorage();
          updatePageTimestampBadge();
          updateSyncCountBadge();
          updateSaveStatusBadge('Đã nạp mốc từ thư mục: ' + jsonNames[ji]);
          return;
        }
      } catch (eDir) {}
    }
  }
// 3. THỨ TỰ ƯU TIÊN 2: Kiểm tra trong bộ nhớ LocalStorage của trình duyệt
  if (await loadCloudSyncForBook()) { showToast('☁️ Đã tải mốc thời gian từ GitHub'); return; }
  const storageKey = `sync_${bookKey}`;
  try { const raw=localStorage.getItem(storageKey); if(raw){const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object'&&Object.keys(parsed).length){state.pageTimestamps=parsed;updatePageTimestampBadge();updateSyncCountBadge();updateSaveStatusBadge('💾 Đã nạp từ bộ nhớ máy');return;}} } catch(e) {}

  // 5. Nếu không có mốc nào: Giữ nguyên rỗng {}
  state.pageTimestamps = {};
  updatePageTimestampBadge();
  updateSyncCountBadge();
}

// =======================================================
// XÂY DỰNG VÀ QUẢN LÝ DANH SÁCH TẬP TRUYỆN (PLAYLIST)
// =======================================================
function buildPlaylistFromItems(rawItems) {
  const groups = {};
  const jsonItems = [];

  // Pass 1: Gom PDF va Audio truoc
  rawItems.forEach(function(item) {
    if (item.type === 'json') {
      jsonItems.push(item);
      return;
    }

    const norm = normalizeStoryTitle(item.name);
    const key = norm.toLowerCase().replace(/\s+/g, "_");

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
      const partMatch = item.name.match(/part[_\s-]*(\d+)|side[_\s-]*([ab])|disc[_\s-]*(\d+)|\b(\d+)\s*of\s*\d+/i);
      item.partLabel = partMatch
        ? (partMatch[1] ? ('Phần ' + partMatch[1]) : partMatch[2] ? ('Mặt ' + partMatch[2].toUpperCase()) : partMatch[3] ? ('Đĩa ' + partMatch[3]) : ('Phần ' + partMatch[4]))
        : null;
      groups[key].audios.push(item);
    }
  });

  // Bước 2: Gán các tệp JSON vào đúng truyện
  jsonItems.forEach(function(jItem) {
    const jNorm = normalizeStoryTitle(jItem.name).toLowerCase().replace(/\s+/g, "_");
    // 1. Khop chinh xac id
    if (groups[jNorm]) {
      groups[jNorm].json = jItem;
      return;
    }
    // 2. Tim nhom nao co id nam trong ten file json hoac nguoc lai
    for (const key of Object.keys(groups)) {
      if (jNorm.includes(key) || key.includes(jNorm)) {
        groups[key].json = jItem;
        return;
      }
    }
  });

  // Chỉ giữ nhóm có PDF hoặc âm thanh; không tạo thẻ giả từ tệp JSON mốc đọc.
  const playlistArray = Object.values(groups).filter(function(g) {
    return g.pdf || (g.audios && g.audios.length > 0);
  });

  playlistArray.forEach(function(story) {
    // Sap xep audio parts theo ten file (part 1 truoc part 2, v.v.)
    story.audios.sort(function(a, b) {
      return a.name.localeCompare(b.name, 'vi', { numeric: true });
    });
    // Gan label mac dinh neu chua co
    if (story.audios.length > 1) {
      story.audios.forEach(function(aud, i) {
        if (!aud.partLabel) aud.partLabel = 'Phần ' + (i + 1);
      });
    }
  });
  playlistArray.sort(function(a, b) {
    return a.title.localeCompare(b.title, 'vi', { numeric: true });
  });

  state.playlist = playlistArray;
  updatePlaylistBadgeCount();
  renderPlaylistView();

  if (playlistArray.length > 0) {
    dom.lblPlaylistSubtitle = document.getElementById('lblPlaylistSubtitle');
    if (dom.lblPlaylistSubtitle) {
      dom.lblPlaylistSubtitle.textContent = 'Tìm thấy ' + playlistArray.length + ' tập truyện trong thư mục';
    }
    dom.playlistModal.classList.remove('hidden');
    showToast('Đã nạp danh sách ' + playlistArray.length + ' tập truyện!');
  }
}
function updatePlaylistBadgeCount() {
  const count = state.playlist.length;
  const available = count > 0;
  dom.btnOpenPlaylist.disabled = !available;
  dom.btnOpenPlaylist.setAttribute('aria-disabled', String(!available));
  dom.btnOpenPlaylist.title = available
    ? 'Mở danh sách tập trong thư mục đã chọn'
    : 'Hãy chọn thư mục trước để mở danh sách tập';
  if (available) {
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
    const matchQuery = !query || story.title.toLowerCase().includes(query) ||
      (story.pdf && story.pdf.name.toLowerCase().includes(query)) ||
      (story.audios.some(a => a.name.toLowerCase().includes(query)));

    if (!matchQuery) return false;

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

  filtered.forEach((story) => {
    const card = document.createElement('div');
    const isPlaying = (state.currentBookKey === story.id);
    card.className = `playlist-card ${isPlaying ? 'active-playing' : ''}`;

    let tagsHtml = '';
    if (story.pdf) {
      tagsHtml += `<span class="mini-badge badge-pdf">📄 ${story.pdf.name}</span>`;
    }
    if (story.audios && story.audios.length > 0) {
      story.audios.forEach((aud) => {
        tagsHtml += `<span class="mini-badge badge-mp3">🎵 ${aud.name}</span>`;
      });
    }

    // Audio parts buttons for multi-audio stories
    var audioPartBtnsHtml = '';
    if (story.audios && story.audios.length > 1) {
      audioPartBtnsHtml = '<div class="card-audio-parts">';
      story.audios.forEach(function(a, i) {
        var lbl = a.partLabel || ('Phần ' + (i + 1));
        audioPartBtnsHtml += '<button class="card-part-btn" data-partidx="' + i + '" title="' + a.name + '">' + lbl + '</button>';
      });
      audioPartBtnsHtml += '</div>';
    }

    let coverHtml = '';
    if (story.coverUrl) {
      coverHtml = `<img src="${story.coverUrl}" class="card-cover" alt="Bìa" loading="lazy" onerror="this.style.display='none'">`;
    }

    card.innerHTML =
      coverHtml +
      '<div class="card-title-col">' +
        '<h4>' + (isPlaying ? '&#9654; ' : '') + story.title + '</h4>' +
        '<div class="card-tags">' + tagsHtml + '</div>' +
        audioPartBtnsHtml +
      '</div>' +
      '<button class="card-play-btn">' + (isPlaying ? 'Đang đọc' : '&#9654; Mở') + '</button>';

    card.addEventListener('click', function(e) {
      if (e.target.classList.contains('card-part-btn')) return;
      loadStoryFromPlaylist(story, 0);
      dom.playlistModal.classList.add('hidden');
    });
    card.querySelectorAll('.card-part-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var partIdx = parseInt(btn.getAttribute('data-partidx'), 10);
        loadStoryFromPlaylist(story, partIdx);
        dom.playlistModal.classList.add('hidden');
      });
    });

    dom.playlistItemsList.appendChild(card);
  });
}

// MỞ TRUYỆN TỪ PLAYLIST (TỰ ĐỘNG NẠP MỐC ĐÚNG CUỐN ĐÓ)
async function loadStoryFromPlaylist(story, audioPartIndex) {
  if (!story) return;

  const uniqueKey = story.id || getBookUniqueKey(story.title);
  state.currentBookKey = uniqueKey;
  state.pdfFileName = (story.pdf && story.pdf.name) ? story.pdf.name : (story.title || uniqueKey) + '.pdf';
  state.currentStoryAudios = story.audios || [];
  state.currentAudioIndex = (typeof audioPartIndex === 'number') ? audioPartIndex : 0;

  dom.lblLoadingText.textContent = `Đang mở: ${story.title}...`;
  dom.pdfLoadingIndicator.classList.remove('hidden');

  try {
    const jsonBlob = story.json ? story.json.blob : null;
    await resetAndLoadSyncForBook(uniqueKey, jsonBlob);

    // 2. Nạp PDF
    let pdfLoaded = false;
    if (story.pdf) {
      if (story.pdf.blob) {
        pdfLoaded = await loadPdfFromBlob(story.pdf.blob, false);
      }
    }

    // 3. Nạp audio part được chọn
    loadAudioPart(state.currentAudioIndex);

    showToast('📖 Đang đọc: ' + story.title);
    renderPlaylistView();
    updateAudioPartUI();
  } catch (err) {
    console.error('Lỗi khi mở truyện từ playlist:', err);
    alert('Không thể mở truyện: ' + err.message);
  } finally {
    dom.pdfLoadingIndicator.classList.add('hidden');
  }
}

// NAP MOT PART AUDIO CU THE
function loadAudioPart(index) {
  const audios = state.currentStoryAudios;
  if (!audios || audios.length === 0) return;
  const clampedIdx = Math.max(0, Math.min(index, audios.length - 1));
  state.currentAudioIndex = clampedIdx;
  const audio = audios[clampedIdx];
  if (audio.blob) {
    loadAudioFromBlob(audio.blob);
  }
  updateAudioPartUI();
}

// CAP NHAT UI THANH CHON AUDIO PART
function updateAudioPartUI() {
  const audios = state.currentStoryAudios;
  let container = document.getElementById('audioPartSelector');

  if (!audios || audios.length <= 1) {
    if (container) container.classList.add('hidden');
    return;
  }

  if (!container) {
    container = document.createElement('div');
    container.id = 'audioPartSelector';
    container.className = 'audio-part-selector';
    const footer = document.querySelector('.app-footer');
    if (footer) footer.insertBefore(container, footer.firstChild);
  }

  container.classList.remove('hidden');
  var html = '<span class="audio-part-label">Phan audio:</span>';
  audios.forEach(function(a, i) {
    var lbl = a.partLabel || ('Phần ' + (i + 1));
    var isActive = (i === state.currentAudioIndex) ? ' active' : '';
    html += '<button class="audio-part-btn' + isActive + '" onclick="selectAudioPart(' + i + ')" title="' + a.name + '">' + lbl + '</button>';
  });
  container.innerHTML = html;
}

// CHON AUDIO PART
window.selectAudioPart = function(index) {
  loadAudioPart(index);
  showToast('Đã chuyển sang phần ' + (index + 1));
};

// Nguồn nội dung: tệp PDF và âm thanh cục bộ; chỉ đồng bộ JSON mốc đọc qua GitHub.
// =======================================================
// SỰ KIỆN GIAO DIỆN
// =======================================================
function initEvents() {
  initIndexedDB();

  dom.btnOpenPlaylist.addEventListener('click', () => {
    if (state.playlist.length === 0) return;
    dom.playlistModal.classList.remove('hidden');
  });

  dom.btnClosePlaylist.addEventListener('click', () => dom.playlistModal.classList.add('hidden'));
  dom.playlistModal.addEventListener('click', (e) => {
    if (e.target === dom.playlistModal) dom.playlistModal.classList.add('hidden');
  });

  dom.txtPlaylistSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderPlaylistView();
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeFilter = e.target.getAttribute('data-filter');
      renderPlaylistView();
    });
  });

  dom.btnNode1FolderOnline.addEventListener('click', () => handleFolderPick());
  dom.btnDirectPdfPicker.addEventListener('click', () => dom.pdfFileInput.click());
  dom.btnToggleSettings.addEventListener('click', () => {
    const willHide = !dom.filePickerSection.classList.contains('hidden');
    dom.filePickerSection.classList.toggle('hidden', willHide);
    dom.syncBanner.classList.toggle('hidden', willHide);
    dom.btnToggleSettings.setAttribute('aria-expanded', String(!willHide));
    dom.btnToggleSettings.title = willHide
      ? 'Hiện dòng chọn tệp, tùy chọn và thanh mốc trang'
      : 'Ẩn dòng chọn tệp, tùy chọn và thanh mốc trang';
  });
  dom.btnChooseAudio.addEventListener('click', () => dom.audioFileInput.click());
  dom.btnCloseNode1Modal.addEventListener('click', () => dom.node1Modal.classList.add('hidden'));
  dom.node1Modal.addEventListener('click', (e) => {
    if (e.target === dom.node1Modal) dom.node1Modal.classList.add('hidden');
  });

  dom.btnTriggerFolderPicker.addEventListener('click', () => {
    dom.node1Modal.classList.add('hidden');
    handleFolderPick();
  });
  dom.btnTriggerPdfPicker.addEventListener('click', () => {
    dom.node1Modal.classList.add('hidden');
    dom.pdfFileInput.click();
  });
  dom.folderInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length) handleFileList(files);
    e.target.value = '';
  });
  dom.pdfFileInput.addEventListener('change', handlePdfFileSelect);
  dom.audioFileInput.addEventListener('change', handleAudioFileSelect);
  dom.cardGuideFolder.addEventListener('click', () => dom.btnNode1FolderOnline.click());
  dom.cardGuidePdf.addEventListener('click', () => dom.pdfFileInput.click());

  dom.btnFitHeight.addEventListener('click', () => setViewMode('fit-height'));
  dom.btnTwoPages.addEventListener('click', () => setViewMode('two-pages'));
  dom.btnZoomIn.addEventListener('click', () => changeZoom(0.15));
  dom.btnZoomOut.addEventListener('click', () => changeZoom(-0.15));

  initDragAndDrop();

dom.selPageTurnMode.value = state.pageTurnMode;
  dom.selPageTurnMode.addEventListener('change', (e) => {
    state.pageTurnMode = e.target.value;
    state.waitingForManualPageTurn = false;
    state.pendingManualPage = null;
    state.resumeAfterManualTurn = false;
    showToast(
      state.pageTurnMode === 'markers'
        ? 'Đến mốc trang kế tiếp, audio sẽ dừng chờ bạn lật trang; nếu không có mốc, audio tiếp tục.'
        : state.pageTurnMode === 'next'
          ? 'Audio tự động lật trang theo mốc thời gian.'
          : 'Đọc liên tục; không tự dừng hoặc tự chuyển trang.'
    );
  });
  dom.chkAutoSeekAudio.addEventListener('change', (e) => { state.autoSeekAudio = e.target.checked; });
  dom.btnPageJump.addEventListener('click', jumpToEnteredPage);
  dom.pageJumpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') jumpToEnteredPage(); });
  dom.btnReplayPage.addEventListener('click', replayCurrentPage);
  dom.speedSelect.addEventListener('change', (e) => setPlaybackSpeed(parseFloat(e.target.value), true));
  initPlaybackSpeed();
  initPdfClickNavigation();

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
  dom.audioElement.addEventListener('timeupdate', onAudioTimeUpdate);
  dom.audioElement.addEventListener('loadedmetadata', onAudioMetadataLoaded);
  dom.audioElement.addEventListener('play', updatePlayButtonState);
  dom.audioElement.addEventListener('pause', updatePlayButtonState);
  dom.audioElement.addEventListener('ended', () => {
    updatePlayButtonState();
    onAudioEnded();
  });
  dom.audioElement.addEventListener('error', () => {
    if (!dom.audioElement.src) return;
    const mediaError = dom.audioElement.error;
    const reason = mediaError && mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ? 'Định dạng hoặc tệp âm thanh không được trình duyệt hỗ trợ.'
      : 'Không thể tải tệp âm thanh. Hãy thử chọn lại file MP3.';
    showToast(reason);
    updatePlayButtonState();
  });

  dom.audioSeeker.addEventListener('input', (e) => {
    dom.audioElement.currentTime = parseFloat(e.target.value);
  });

  dom.btnOpenSyncModal.addEventListener('click', openSyncModal);
  dom.btnCloseSyncModal.addEventListener('click', () => dom.syncModal.classList.add('hidden'));
  dom.syncModal.addEventListener('click', (e) => {
    if (e.target === dom.syncModal) dom.syncModal.classList.add('hidden');
  });

  dom.btnExportSync.addEventListener('click', exportSyncData);
  dom.btnSaveToGithubFolder.addEventListener('click', () => syncCurrentBookToGitHub({ askForToken: true }));
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
  e.target.value = '';
  if (!file) return;

  const key = getBookUniqueKey(file.name);
  state.currentBookKey = key;
  dom.btnChooseAudio.classList.remove('hidden');
  state.pdfSelectionInProgress = true;
  state.currentStoryAudios = [];
  state.currentAudioIndex = 0;
  dom.audioElement.pause();
  dom.audioElement.removeAttribute('src');
  dom.audioElement.load();
  dom.audioFileName.textContent = '🎵 Chưa có MP3';
  dom.audioFileName.classList.add('empty');
  updateAudioPartUI();

  // Không tự mở hộp thoại MP3; người dùng chủ động bấm nút "Chọn MP3".
  try {
    await loadPdfFromBlob(file, true);
    saveBookToLibrary({
      id: key,
      pdfName: file.name,
      pdfBlob: file
    });
  } finally {
    state.pdfSelectionInProgress = false;
  }
  showToast('Đã mở PDF. Chọn file MP3 tương ứng để bắt đầu nghe.');
}

async function handleAudioFileSelect(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  // Reset input để người dùng có thể chọn lại cùng file nếu muốn
  e.target.value = '';

  // Chuyển danh sách file thành audio items có partLabel và sắp xếp
  const audioItems = files.map(f => {
    const partMatch = f.name.match(/part[_\s-]*(\d+)|side[_\s-]*([ab])|disc[_\s-]*(\d+)|\b(\d+)\s*of\s*\d+/i);
    const partLabel = partMatch
      ? (partMatch[1] ? ('Phần ' + partMatch[1]) : partMatch[2] ? ('Mặt ' + partMatch[2].toUpperCase()) : partMatch[3] ? ('Đĩa ' + partMatch[3]) : ('Phần ' + partMatch[4]))
      : null;
    return {
      name: f.name,
      blob: f,
      type: 'audio',
      partLabel: partLabel
    };
  });

  audioItems.sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
  if (audioItems.length > 1) {
    audioItems.forEach((aud, i) => {
      if (!aud.partLabel) aud.partLabel = 'Phần ' + (i + 1);
    });
  }

  // Cập nhật danh sách audio đang mở vào state
  state.currentStoryAudios = audioItems;
  state.currentAudioIndex = 0;
  if (state.pdfDoc) dom.btnChooseAudio.classList.remove('hidden');

  // Nạp part đầu tiên và hiển thị thanh chọn part
  loadAudioPart(0);
  updateAudioPartUI();

  if (audioItems.length > 1) {
    showToast(`🎵 Đã nạp ${audioItems.length} phần âm thanh!`);
  }

  // Tìm kiếm PDF tương ứng nếu chưa mở PDF
  const key = getBookUniqueKey(files[0].name);
  if (!state.pdfDoc && !state.pdfSelectionInProgress) {
    const saved = await getBookFromLibrary(key);
    if (saved && saved.pdfBlob) {
      state.currentBookKey = key;
      await loadPdfFromBlob(saved.pdfBlob, true);
      showToast(`⚡ Đã tự động mở PDF: ${saved.pdfName}`);
    }
  }

  const currentKey = state.currentBookKey || key;
  saveBookToLibrary({
    id: currentKey,
    audioName: audioItems[0].name,
    audioBlob: audioItems[0].blob,
    audios: audioItems
  });
}

// =======================================================
// XỬ LÝ NÚT 1: CHỌN THƯ MỤC TRÊN MÁY
// =======================================================
async function handleFolderPick() {
  if ('showDirectoryPicker' in window) {
    try {
      state.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const files = [];
      for await (const entry of state.dirHandle.values()) {
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

async function loadPdfFromBlob(file, shouldResetSync = true) {
  state.pdfFileName = file.name;
  dom.pdfFileName.textContent = `📄 ${file.name}`;
  dom.pdfFileName.classList.remove('empty');
  dom.lblLoadingText.textContent = 'Đang tải trang sách...';
  dom.pdfLoadingIndicator.classList.remove('hidden');

  const key = getBookUniqueKey(file.name);
  state.currentBookKey = key;

  if (shouldResetSync) {
    await resetAndLoadSyncForBook(key, null);
  }

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
  dom.audioElement.playbackRate = state.speeds[state.speedIndex] || 1.0;
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
    const rawTarget = state.pageTimestamps[leftPageNum];
    if (typeof rawTarget === 'number') {
      dom.audioElement.currentTime = rawTarget;
    } else if (rawTarget && typeof rawTarget === 'object' && typeof rawTarget.time === 'number') {
      if (rawTarget.part !== undefined && rawTarget.part !== state.currentAudioIndex && state.currentStoryAudios && state.currentStoryAudios[rawTarget.part]) {
        loadAudioPart(rawTarget.part);
        setTimeout(() => {
          dom.audioElement.currentTime = rawTarget.time;
        }, 300);
      } else {
        dom.audioElement.currentTime = rawTarget.time;
      }
    }
  }
}

function setViewMode(mode) {
  state.viewMode = mode;
  state.zoomScale = 1.0;
  updateZoomLabel();

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
  const previousPage = state.pageNum;
  const step = (state.viewMode === 'two-pages') ? 2 * delta : delta;
  const newPage = state.pageNum + step;

  if (newPage >= 1 && newPage <= state.totalPages) {
    state.pageNum = newPage;
  } else if (delta > 0 && state.pageNum < state.totalPages) {
    state.pageNum = state.totalPages;
  } else if (delta < 0 && state.pageNum > 1) {
    state.pageNum = 1;
  } else {
    return;
  }

  state.isAudioDrivenChange = false;
  renderCurrentSpread();

  // Nếu audio đang chờ người đọc lật đến trang kế tiếp, tiếp tục tại đúng mốc.
  if (state.waitingForManualPageTurn && state.pendingManualPage !== null) {
    const reachedPendingPage = delta > 0 && state.pageNum >= state.pendingManualPage;
    if (reachedPendingPage) {
      const shouldResume = state.resumeAfterManualTurn;
      state.waitingForManualPageTurn = false;
      state.pendingManualPage = null;
      state.resumeAfterManualTurn = false;
      if (shouldResume) {
        // renderCurrentSpread có thể tua đến mốc trang; chờ cập nhật seek rồi phát tiếp.
        const resume = () => {
          dom.audioElement.removeEventListener('seeked', resume);
          dom.audioElement.play().catch(() => {});
        };
        dom.audioElement.addEventListener('seeked', resume, { once: true });
        setTimeout(() => {
          if (dom.audioElement.seeking) return;
          dom.audioElement.removeEventListener('seeked', resume);
          dom.audioElement.play().catch(() => {});
        }, 150);
      }
    }
  }
}

function updatePageTimestampBadge() {
  const ts = state.pageTimestamps[state.pageNum];
  if (typeof ts === 'number') {
    dom.lblPageTimestamp.textContent = 'Mốc: ' + formatTime(ts);
    dom.lblPageTimestamp.style.color = '#38bdf8';
  } else if (ts && typeof ts === 'object' && typeof ts.time === 'number') {
    const partTxt = (ts.part !== undefined) ? (' (Phần ' + (ts.part + 1) + ')') : '';
    dom.lblPageTimestamp.textContent = 'Mốc: ' + formatTime(ts.time) + partTxt;
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
// GHIM MỐC & TỰ ĐỘNG GHI FILE VÀO THƯ MỤC TRÊN MÁY
// =======================================================
async function pinCurrentTimeToPage() {
  if (!state.pdfDoc) {
    alert('Vui lòng chọn file PDF trước!');
    return;
  }
  const currentTime = dom.audioElement.currentTime || 0;
  const roundedTime = Math.round(currentTime * 10) / 10;

  if (state.currentStoryAudios && state.currentStoryAudios.length > 1) {
    state.pageTimestamps[state.pageNum] = {
      time: roundedTime,
      part: state.currentAudioIndex
    };
  } else {
    state.pageTimestamps[state.pageNum] = roundedTime;
  }

  // 1. Lưu vào LocalStorage
  saveSyncToStorage();
  updatePageTimestampBadge();
  updateSyncCountBadge();

  // 2. Tự động lưu trực tiếp vào thư mục trên máy (nếu đang mở qua chọn thư mục)
  await autoSaveSyncToLocalDirectory();
  scheduleGitHubSync();

  const originalText = dom.btnPinCurrentTime.textContent;
  dom.btnPinCurrentTime.textContent = 'Đã ghim: ' + formatTime(roundedTime) + '!';
  dom.btnPinCurrentTime.style.backgroundColor = '#10b981';
  setTimeout(() => {
    dom.btnPinCurrentTime.textContent = originalText;
    dom.btnPinCurrentTime.style.backgroundColor = '';
  }, 1200);
}
// Tự động ghi thẳng file mốc .json vào thư mục máy tính
async function autoSaveSyncToLocalDirectory() {
  if (state.dirHandle && 'createWritable' in FileSystemFileHandle.prototype) {
    try {
      const fileName = getSyncFileName();
      const fileHandle = await state.dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(state.pageTimestamps, null, 2));
      await writable.close();
      updateSaveStatusBadge(`🟢 Đã tự lưu vào folder: ${fileName}`);
      return true;
    } catch (e) {
      console.log('Không thể tự động ghi vào thư mục: ', e);
    }
  }
  updateSaveStatusBadge('💾 Đã lưu vào bộ nhớ máy');
  return false;
}

function getSyncFileName() {
  const base = state.currentBookKey || 'truyen';
  return `${getSyncStem()}.json`;
}

async function saveSyncToDirectoryOrDownload() {
  if (Object.keys(state.pageTimestamps).length === 0) {
    alert('Chưa có mốc thời gian nào để lưu!');
    return;
  }
  const autoSaved = await autoSaveSyncToLocalDirectory();
  if (autoSaved) {
    showToast(`🟢 Đã lưu thẳng file mốc vào thư mục máy tính!`);
  } else {
    exportSyncData();
    showToast(`💾 Đã tải file [${getSyncFileName()}] về máy!`);
  }
}

function updatePlayButtonState() {
  const isPlaying = !dom.audioElement.paused && !dom.audioElement.ended;
  dom.playPauseIcon.textContent = isPlaying ? 'Ⅱ' : '▶';
  dom.btnPlayPause.setAttribute('aria-label', isPlaying ? 'Tạm dừng' : 'Phát');
  dom.btnPlayPause.title = isPlaying ? 'Tạm dừng' : 'Phát';
  dom.btnPlayPause.setAttribute('aria-pressed', String(isPlaying));
  dom.btnPlayPause.classList.toggle('is-playing', isPlaying);
}

async function togglePlayPause() {
  const hasAudioSource = Boolean(dom.audioElement.currentSrc || dom.audioElement.src);
  if (!hasAudioSource || !state.currentStoryAudios || state.currentStoryAudios.length === 0) {
    showToast('Chưa có MP3. Hãy chọn PDF (nếu cần), sau đó bấm “Chọn MP3” để nạp âm thanh.');
    dom.btnChooseAudio.classList.remove('hidden');
    dom.btnChooseAudio.focus({ preventScroll: true });
    return;
  }

  if (!dom.audioElement.paused && !dom.audioElement.ended) {
    dom.audioElement.pause();
    return;
  }

  try {
    // Đưa nút về trạng thái tạm dừng trong khi trình duyệt bắt đầu phát.
    await dom.audioElement.play();
  } catch (error) {
    updatePlayButtonState();
    console.error('Không thể phát âm thanh:', error);
    const message = error && error.name === 'NotAllowedError'
      ? 'Trình duyệt chặn phát âm thanh. Hãy bấm Play trực tiếp sau khi chọn MP3.'
      : error && error.name === 'NotSupportedError'
        ? 'File âm thanh không được trình duyệt hỗ trợ. Hãy chọn file MP3 khác.'
        : 'Không phát được âm thanh. Hãy kiểm tra file MP3 rồi thử lại.';
    showToast(message);
  }
}

const PLAYBACK_SPEED_STORAGE_KEY = 'pdfAudioSyncPlaybackSpeed';
function setPlaybackSpeed(speed, persist = false) {
  const safeSpeed = state.speeds.includes(speed) ? speed : 1.0;
  state.speedIndex = state.speeds.indexOf(safeSpeed);
  dom.audioElement.playbackRate = safeSpeed;
  dom.speedSelect.value = String(safeSpeed);
  if (persist) {
    try { localStorage.setItem(PLAYBACK_SPEED_STORAGE_KEY, String(safeSpeed)); } catch (e) {}
  }
}
function initPlaybackSpeed() {
  let savedSpeed = 1.0;
  try {
    const stored = parseFloat(localStorage.getItem(PLAYBACK_SPEED_STORAGE_KEY));
    if (state.speeds.includes(stored)) savedSpeed = stored;
  } catch (e) {}
  setPlaybackSpeed(savedSpeed);
}
function jumpToEnteredPage() {
  if (!state.pdfDoc) { showToast('Vui lòng mở PDF trước.'); return; }
  const raw = dom.pageJumpInput.value.trim();
  const target = Number(raw);
  if (!raw || !Number.isInteger(target) || target < 1 || target > state.totalPages) {
    showToast('Nhập số trang từ 1 đến ' + state.totalPages + '.');
    dom.pageJumpInput.focus();
    return;
  }
  state.pageNum = state.viewMode === 'two-pages' ? (target % 2 === 0 ? Math.max(1, target - 1) : target) : target;
  state.isAudioDrivenChange = false;
  state.waitingForManualPageTurn = false;
  state.pendingManualPage = null;
  state.resumeAfterManualTurn = false;
  renderCurrentSpread();
  dom.pageJumpInput.value = '';
}
function getCurrentPageTimestamp(page) {
  const raw = state.pageTimestamps[page];
  if (typeof raw === 'number' && Number.isFinite(raw)) return { time: raw, part: 0 };
  if (raw && typeof raw === 'object' && Number.isFinite(raw.time)) {
    return { time: raw.time, part: Number.isInteger(raw.part) ? raw.part : 0 };
  }
  return null;
}
function replayCurrentPage() {
  if (!state.pdfDoc) { showToast('Vui lòng mở PDF trước.'); return; }
  const marker = getCurrentPageTimestamp(state.pageNum);
  if (!marker) { showToast('Trang hiện tại chưa có mốc thời gian.'); return; }
  if (!dom.audioElement.src && !(state.currentStoryAudios && state.currentStoryAudios.length)) {
    showToast('Vui lòng mở tệp MP3 trước.');
    return;
  }
  const seekAndPlay = () => {
    dom.audioElement.currentTime = Math.max(0, marker.time);
    dom.audioElement.playbackRate = state.speeds[state.speedIndex] || 1;
    dom.audioElement.play().catch(() => showToast('Không thể phát audio. Hãy bấm Phát để thử lại.'));
  };
  if (state.currentStoryAudios && state.currentStoryAudios.length > 1 &&
      marker.part !== state.currentAudioIndex && state.currentStoryAudios[marker.part]) {
    dom.audioElement.pause();
    dom.audioElement.addEventListener('loadedmetadata', function onReplayMetadata() {
      dom.audioElement.removeEventListener('loadedmetadata', onReplayMetadata);
      seekAndPlay();
    }, { once: true });
    loadAudioPart(marker.part);
  } else {
    seekAndPlay();
  }
}
function initPdfClickNavigation() {
  dom.canvasWrapper.addEventListener('click', (event) => {
    if (!state.pdfDoc || event.button !== 0 || event.target.tagName !== 'CANVAS') return;
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const direction = state.viewMode === 'two-pages'
      ? (canvas.id === 'pdfCanvasLeft' ? -1 : 1)
      : ((event.clientX - rect.left) < rect.width / 2 ? -1 : 1);
    changePage(direction);
  });
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

  const hasPageMarkers = Object.keys(state.pageTimestamps).length > 0;
  if (!hasPageMarkers && state.pageTurnMode === 'next') {
    // Không có mốc thời gian: tự chuyển sang chế độ chờ lật trang.
    // Chế độ này chỉ dừng khi có mốc hợp lệ; vì không có mốc nên audio vẫn chạy liên tục.
    state.pageTurnMode = 'markers';
    dom.selPageTurnMode.value = 'markers';
  }
  if (!state.pdfDoc || state.pageTurnMode === 'off' || !hasPageMarkers) return;

  const currentPart = state.currentAudioIndex || 0;
  const matchesCurrentPart = (marker) =>
    !state.currentStoryAudios || state.currentStoryAudios.length <= 1 || marker.part === currentPart;
  const step = state.viewMode === 'two-pages' ? 2 : 1;
  const nextPage = state.pageNum + step;
  const nextMarker = nextPage <= state.totalPages ? getCurrentPageTimestamp(nextPage) : null;

  // Chế độ chờ lật trang: chỉ dừng nếu trang kế tiếp có mốc hợp lệ.
  // Tệp không có mốc cho trang kế tiếp sẽ tiếp tục phát bình thường.
  if (state.pageTurnMode === 'markers') {
    if (state.waitingForManualPageTurn || !nextMarker || !matchesCurrentPart(nextMarker)) return;
    if (curr >= nextMarker.time) {
      state.waitingForManualPageTurn = true;
      state.pendingManualPage = nextPage;
      state.resumeAfterManualTurn = !dom.audioElement.paused;
      dom.audioElement.currentTime = nextMarker.time;
      dom.audioElement.pause();
      showToast('Đã hết phần audio của trang này. Lật sang trang kế tiếp để đọc tiếp.');
    }
    return;
  }

  // Chế độ tự chuyển trang: chuyển đến trang có mốc khi audio chạm mốc đó.
  if (state.pageTurnMode === 'next' && nextMarker && matchesCurrentPart(nextMarker) && curr >= nextMarker.time) {
    state.isAudioDrivenChange = true;
    state.pageNum = nextPage;
    renderCurrentSpread();
    setTimeout(() => { state.isAudioDrivenChange = false; }, 400);
  }
}
function getStorageKey() {
  return `sync_${state.currentBookKey || 'default'}`;
}

function saveSyncToStorage() {
  if (!state.currentBookKey) return;
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
    const rawTs = state.pageTimestamps[p];
    const hasTime = (typeof rawTs === 'number') || (rawTs && typeof rawTs === 'object' && typeof rawTs.time === 'number');
    const sec = typeof rawTs === 'number' ? rawTs : (hasTime ? rawTs.time : 0);
    const partNum = (hasTime && rawTs && rawTs.part !== undefined) ? rawTs.part : null;
    const partTxt = (partNum !== null) ? (' <span style="font-size:0.75rem;color:#38bdf8;">(Phần ' + (partNum + 1) + ')</span>') : '';

    tr.innerHTML = '<td><b>Trang ' + p + '</b></td>' +
      '<td>' + (hasTime ? (formatTime(sec) + partTxt) : '<span style="color:#64748b;">(Chưa có)</span>') + '</td>' +
      '<td>' +
        (hasTime ? ('<button class="btn-mini-play" onclick="seekAndPlayTo(' + sec + ', ' + p + ', ' + (partNum !== null ? partNum : 'null') + ')">▶ Nghe</button>') : '') +
        (hasTime ? ('<button class="btn-mini-del" onclick="deleteSync(' + p + ')">✕ Xóa</button>') : '') +
        '<button class="btn-mini-play" onclick="setManualSync(' + p + ')">✏️ Đặt</button>' +
      '</td>';
    dom.syncTableBody.appendChild(tr);
  }
}

window.seekAndPlayTo = function(seconds, page, part) {
  if (part !== null && part !== undefined && part !== state.currentAudioIndex && state.currentStoryAudios && state.currentStoryAudios[part]) {
    loadAudioPart(part);
    setTimeout(() => {
      dom.audioElement.currentTime = seconds;
      dom.audioElement.play();
    }, 300);
  } else {
    dom.audioElement.currentTime = seconds;
    dom.audioElement.play();
  }
  state.pageNum = page;
  renderCurrentSpread();
  dom.syncModal.classList.add('hidden');
};
window.deleteSync = function(page) {
  delete state.pageTimestamps[page];
  saveSyncToStorage();
  autoSaveSyncToLocalDirectory();
  scheduleGitHubSync();
  updatePageTimestampBadge();
  updateSyncCountBadge();
  renderSyncTable();
};

window.setManualSync = function(page) {
  const rawVal = state.pageTimestamps[page];
  const currentValSec = (typeof rawVal === 'number') ? rawVal : (rawVal && typeof rawVal === 'object' && typeof rawVal.time === 'number') ? rawVal.time : Math.floor(dom.audioElement.currentTime || 0);
  const input = prompt(`Nhập số giây bắt đầu cho Trang ${page} (hoặc dạng MM:SS):`, formatTime(currentValSec));
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
    if (state.currentStoryAudios && state.currentStoryAudios.length > 1) {
      let partIdx = state.currentAudioIndex;
      if (rawVal && typeof rawVal === 'object' && typeof rawVal.part === 'number') {
        partIdx = rawVal.part;
      }
      const partInput = prompt(`Trang ${page} thuộc phần audio nào? (1 đến ${state.currentStoryAudios.length}):`, (partIdx + 1));
      if (partInput) {
        const parsedPart = parseInt(partInput, 10);
        if (!isNaN(parsedPart) && parsedPart >= 1 && parsedPart <= state.currentStoryAudios.length) {
          partIdx = parsedPart - 1;
        }
      }
      state.pageTimestamps[page] = {
        time: seconds,
        part: partIdx
      };
    } else {
      state.pageTimestamps[page] = seconds;
    }
    saveSyncToStorage();
    autoSaveSyncToLocalDirectory();
    scheduleGitHubSync();
    updatePageTimestampBadge();
    updateSyncCountBadge();
    renderSyncTable();
  } else {
    alert('Giá trị thời gian không hợp lệ!');
  }
};

function clearAllSync() {
  if (confirm('Bạn có chắc muốn xóa tất cả mốc đồng bộ của cuốn truyện này không?')) {
    state.pageTimestamps = {};
    saveSyncToStorage();
    autoSaveSyncToLocalDirectory();
    scheduleGitHubSync();
    updatePageTimestampBadge();
    updateSyncCountBadge();
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
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (typeof imported === 'object') {
        state.pageTimestamps = imported;
        saveSyncToStorage();
        autoSaveSyncToLocalDirectory();
        scheduleGitHubSync();
        updatePageTimestampBadge();
        updateSyncCountBadge();
        renderSyncTable();
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

// TỰ ĐỘNG CHUYỂN SANG PART AUDIO TIẾP THEO KHI KẾT THÚC
function onAudioEnded() {
  const audios = state.currentStoryAudios;
  if (audios && audios.length > 1 && state.currentAudioIndex < audios.length - 1) {
    const nextIdx = state.currentAudioIndex + 1;
    showToast('🎵 Tự động chuyển sang phần ' + (nextIdx + 1));
    loadAudioPart(nextIdx);
    // Tự động phát tiếp sau khi load
    setTimeout(() => {
      dom.audioElement.play().catch(() => {});
    }, 500);
  }
}

document.addEventListener('DOMContentLoaded', initEvents);
