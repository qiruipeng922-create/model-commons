const config = window.MODEL_HUB_CONFIG;

const categoryLabels = {
  problem: "题目",
  article: "文章",
  code: "代码"
};

const state = {
  files: [],
  uploading: false,
  activeCategory: "problem",
  categories: {
    problem: [],
    article: [],
    code: []
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  uploadForm: $("#uploadForm"),
  fileInput: $("#fileInput"),
  dropZone: $("#dropZone"),
  browseButton: $("#browseButton"),
  fileQueue: $("#fileQueue"),
  fileList: $("#fileList"),
  queueSummary: $("#queueSummary"),
  clearQueueButton: $("#clearQueueButton"),
  uploaderName: $("#uploaderName"),
  submissionNote: $("#submissionNote"),
  completionText: $("#completionText"),
  completionBar: $("#completionBar"),
  submitButton: $("#submitButton"),
  uploadError: $("#uploadError"),
  libraryGrid: $("#libraryGrid"),
  librarySummary: $("#librarySummary"),
  refreshRecords: $("#refreshRecords"),
  maxFileSize: $("#maxFileSize"),
  toast: $("#toast"),
  toastTitle: $("#toastTitle"),
  toastText: $("#toastText")
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extensionOf(name) {
  const parts = String(name).split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function showToast(title, text, type = "success") {
  elements.toastTitle.textContent = title;
  elements.toastText.textContent = text;
  elements.toast.classList.toggle("error", type === "error");
  elements.toast.classList.add("show");
  elements.toast.setAttribute("aria-hidden", "false");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
    elements.toast.setAttribute("aria-hidden", "true");
  }, 4200);
}

function selectedCategory() {
  return $('input[name="category"]:checked')?.value || "problem";
}

function selectCategory(category, shouldScroll = false) {
  if (!categoryLabels[category]) return;
  state.activeCategory = category;
  $$(".library-tabs [data-category]").forEach((button) => {
    const active = button.dataset.category === category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  renderLibrary();
  if (shouldScroll) {
    $("#library").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function queueCategory() {
  return selectedCategory();
}

function safeFilePart(value, maxLength = 34) {
  return String(value || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function encodeMetadata(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeMetadata(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function validFile(file) {
  const extension = extensionOf(file.name);
  const blocked = new Set([
    "exe", "dmg", "pkg", "app", "msi", "bat", "cmd", "com", "scr", "vbs",
    "jar", "apk", "bin", "iso"
  ]);
  if (!extension) return "文件需要带有扩展名";
  if (blocked.has(extension)) return "出于安全考虑，不支持该文件类型";
  if (file.size > config.maxFileMb * 1024 * 1024) {
    return `文件超过 ${config.maxFileMb} MB 限制`;
  }
  return "";
}

function addFiles(fileList) {
  elements.uploadError.textContent = "";
  const rejected = [];

  for (const file of [...fileList]) {
    if (state.files.length >= config.maxFiles) {
      rejected.push(`一次最多上传 ${config.maxFiles} 个文件`);
      break;
    }

    const duplicate = state.files.some(
      (item) =>
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
    );
    if (duplicate) continue;

    const problem = validFile(file);
    if (problem) {
      rejected.push(`${file.name}：${problem}`);
      continue;
    }

    state.files.push({
      id: crypto.randomUUID(),
      file,
      status: "queued",
      progress: 0
    });
  }

  if (rejected.length) {
    elements.uploadError.textContent = rejected.join("；");
    showToast("部分文件未加入", rejected[0], "error");
  }
  elements.fileInput.value = "";
  renderQueue();
}

function renderQueue() {
  const category = queueCategory();
  elements.fileQueue.hidden = state.files.length === 0;
  elements.fileList.innerHTML = state.files
    .map((item) => {
      const extension = extensionOf(item.file.name);
      const stateLabel =
        item.status === "uploading"
          ? `${Math.round(item.progress)}%`
          : item.status === "success"
            ? "已上传"
            : item.status === "error"
              ? "失败"
              : "";
      return `
        <div class="file-row" data-file-id="${item.id}" data-category="${category}">
          <span class="file-type">${escapeHtml(extension || "file")}</span>
          <div class="file-name">
            <strong title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong>
            <small>${formatBytes(item.file.size)}</small>
          </div>
          <span class="category-pill">${categoryLabels[category]}</span>
          ${
            item.status === "queued"
              ? `<button class="file-action remove-file" type="button" aria-label="移除 ${escapeHtml(item.file.name)}">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>
                </button>`
              : `<span class="file-state ${item.status}">${stateLabel}</span>`
          }
          ${
            item.status === "uploading"
              ? `<div class="file-progress"><b style="width:${item.progress}%"></b></div>`
              : ""
          }
          ${
            item.status === "error"
              ? `<div class="file-progress"><b style="width:100%;background:var(--danger)"></b></div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  const totalSize = state.files.reduce((sum, item) => sum + item.file.size, 0);
  elements.queueSummary.textContent = `${state.files.length} 个文件 · ${formatBytes(totalSize)} · 将上传至${categoryLabels[category]}`;
  elements.completionText.textContent = `${state.files.length} / ${config.maxFiles}`;
  elements.completionBar.style.width = `${Math.min(100, (state.files.length / config.maxFiles) * 100)}%`;
  elements.submitButton.disabled = state.files.length === 0 || state.uploading;
  elements.clearQueueButton.disabled = state.uploading;
  elements.submitButton.querySelector("span").textContent = state.uploading ? "正在上传" : "开始上传";
}

elements.fileList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-file");
  if (!removeButton || state.uploading) return;
  const row = removeButton.closest(".file-row");
  state.files = state.files.filter((item) => item.id !== row.dataset.fileId);
  renderQueue();
});

elements.clearQueueButton.addEventListener("click", () => {
  if (state.uploading) return;
  state.files = [];
  elements.uploadError.textContent = "";
  renderQueue();
});

elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files));
elements.browseButton.addEventListener("click", (event) => {
  event.stopPropagation();
  elements.fileInput.click();
});
elements.dropZone.addEventListener("click", (event) => {
  if (!event.target.closest("button") && !state.uploading) elements.fileInput.click();
});
elements.dropZone.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && !state.uploading) {
    event.preventDefault();
    elements.fileInput.click();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!state.uploading) elements.dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
});

elements.dropZone.addEventListener("drop", (event) => {
  if (!state.uploading && event.dataTransfer?.files?.length) {
    addFiles(event.dataTransfer.files);
  }
});

$$('input[name="category"]').forEach((input) => {
  input.addEventListener("change", renderQueue);
});

async function writeMetadata(category, metadata) {
  const namespaces = config.metadata.namespaces[category];
  const namespace = namespaces[Math.floor(Math.random() * namespaces.length)];
  const path = `files/${Date.now()}-${metadata.id}.${encodeMetadata(metadata)}`;
  const response = await fetch(`${config.metadata.endpoint}/${namespace}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true })
  });
  if (!response.ok) throw new Error(`云端索引写入失败（${response.status}）`);
}

function uploadFile(item, category) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("time", `${config.storage.retentionHours}h`);
    formData.append("fileToUpload", item.file, item.file.name);
    xhr.open("POST", config.storage.endpoint);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        item.progress = (event.loaded / event.total) * 100;
        item.status = "uploading";
        renderQueue();
      }
    });
    xhr.addEventListener("load", async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const url = xhr.responseText.trim();
        if (!url.startsWith("https://litter.catbox.moe/")) {
          item.status = "error";
          renderQueue();
          reject(new Error("云端文件地址无效，请重试。"));
          return;
        }
        try {
          await writeMetadata(category, {
            id: item.id,
            name: item.file.name,
            size: item.file.size,
            uploader: safeFilePart(elements.uploaderName.value || "匿名用户", 30),
            note: safeFilePart(elements.submissionNote.value, 120),
            url,
            uploadedAt: new Date().toISOString(),
            category
          });
          item.progress = 100;
          item.status = "success";
          renderQueue();
          resolve();
        } catch (error) {
          item.status = "error";
          renderQueue();
          reject(error);
        }
      } else {
        item.status = "error";
        renderQueue();
        reject(new Error(`云端返回 ${xhr.status}，请稍后重试。`));
      }
    });
    xhr.addEventListener("error", () => {
      item.status = "error";
      renderQueue();
      reject(new Error("无法连接云端文件服务，请稍后重试。"));
    });
    xhr.addEventListener("abort", () => {
      item.status = "error";
      renderQueue();
      reject(new Error("上传已取消。"));
    });
    item.status = "uploading";
    item.progress = 0;
    renderQueue();
    xhr.send(formData);
  });
}

async function uploadInBatches(category) {
  let cursor = 0;
  const failures = [];
  const concurrency = 2;

  async function worker() {
    while (cursor < state.files.length) {
      const index = cursor++;
      try {
        await uploadFile(state.files[index], category);
      } catch (error) {
        failures.push({ item: state.files[index], error });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return failures;
}

elements.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.files.length || state.uploading) return;

  const category = selectedCategory();
  state.uploading = true;
  elements.uploadError.textContent = "";
  if (elements.uploaderName.value.trim()) {
    localStorage.setItem("model-commons:uploader", elements.uploaderName.value.trim());
  }
  renderQueue();

  try {
    const failures = await uploadInBatches(category);
    await loadAllCategories();
    selectCategory(category);

    if (failures.length === 0) {
      showToast(
        "上传完成",
        `${state.files.length} 个文件已加入${categoryLabels[category]}分区。`
      );
      state.files = [];
      elements.submissionNote.value = "";
    } else {
      showToast(
        "部分文件未完成",
        `${failures.length} 个文件上传失败，可重新提交。`,
        "error"
      );
      elements.uploadError.textContent = failures.map((entry) => entry.error.message).join("；");
      state.files = state.files.filter((item) => item.status !== "success");
    }
  } catch (error) {
    elements.uploadError.textContent = error.message;
    showToast("上传异常", error.message, "error");
  } finally {
    state.uploading = false;
    renderQueue();
  }
});

async function fetchCategory(category) {
  const namespaces = config.metadata.namespaces[category];
  const responses = await Promise.all(
    namespaces.map(async (namespace) => {
      const response = await fetch(
        `${config.metadata.endpoint}/list/${namespace}?${Date.now()}`,
        { cache: "no-store" }
      );
      if (response.status === 404) return [];
      if (!response.ok) {
        throw new Error(`读取${categoryLabels[category]}失败（${response.status}）`);
      }
      return (await response.json()).entries || [];
    })
  );

  const freshAfter = Date.now() - config.storage.retentionHours * 60 * 60 * 1000;
  return responses
    .flat()
    .flatMap((entry) => {
      if (!entry.path?.startsWith("files/")) return [];
      const encoded = entry.path.split(".").at(-1);
      try {
        const metadata = decodeMetadata(encoded);
        if (
          metadata.category !== category ||
          !String(metadata.url || "").startsWith("https://litter.catbox.moe/") ||
          new Date(metadata.uploadedAt).getTime() < freshAfter
        ) {
          return [];
        }
        return [{ ...metadata, downloadUrl: metadata.url }];
      } catch {
        return [];
      }
    })
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

async function loadAllCategories(showFeedback = false) {
  elements.refreshRecords.disabled = true;
  elements.refreshRecords.classList.add("is-loading");
  try {
    const [problem, article, code] = await Promise.all([
      fetchCategory("problem"),
      fetchCategory("article"),
      fetchCategory("code")
    ]);
    state.categories = { problem, article, code };
    renderCounts();
    renderLibrary();
    if (showFeedback) showToast("资料库已更新", "三个分区的内容均已重新读取。");
  } catch (error) {
    elements.librarySummary.textContent = "资料库暂时无法读取";
    elements.libraryGrid.innerHTML = `
      <div class="library-empty">
        <span>!</span>
        <p>${escapeHtml(error.message)}</p>
        <small>请稍后点击刷新重试</small>
      </div>
    `;
    if (showFeedback) showToast("读取失败", error.message, "error");
  } finally {
    elements.refreshRecords.disabled = false;
    elements.refreshRecords.classList.remove("is-loading");
  }
}

function renderCounts() {
  for (const category of Object.keys(categoryLabels)) {
    const count = state.categories[category].length;
    $(`#${category}Count`).textContent = count;
    $(`#${category}SideCount`).textContent = count;
  }
}

function renderLibrary() {
  const category = state.activeCategory;
  const files = state.categories[category];
  elements.librarySummary.textContent =
    `${categoryLabels[category]}分区 · ${files.length} 个文件 · 所有人可见`;

  if (!files.length) {
    elements.libraryGrid.innerHTML = `
      <div class="library-empty">
        <span>∅</span>
        <p>${categoryLabels[category]}分区还没有文件</p>
        <small>上传后，所有访问者都能在这里看到</small>
      </div>
    `;
    return;
  }

  elements.libraryGrid.innerHTML = files
    .map((file) => {
      const extension = extensionOf(file.name);
      return `
        <article class="library-file" data-category="${category}">
          <div class="library-file-top">
            <span class="file-type">${escapeHtml(extension || "file")}</span>
            <span class="library-date">${formatDate(file.uploadedAt)}</span>
          </div>
          <h3 title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</h3>
          <p>${escapeHtml(file.note || "未填写文件说明")}</p>
          <div class="library-file-meta">
            <span>${escapeHtml(file.uploader)}</span>
            <span>${formatBytes(file.size)}</span>
          </div>
          <a href="${file.downloadUrl}" target="_blank" rel="noopener">
            查看并下载
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14"/>
            </svg>
          </a>
        </article>
      `;
    })
    .join("");
}

$$(".library-tabs [data-category]").forEach((button) => {
  button.addEventListener("click", () => selectCategory(button.dataset.category));
});

$$('[data-nav-category]').forEach((link) => {
  link.addEventListener("click", () => selectCategory(link.dataset.navCategory));
});

elements.refreshRecords.addEventListener("click", () => loadAllCategories(true));

function initialize() {
  elements.maxFileSize.textContent = `${config.maxFileMb} MB`;
  elements.uploaderName.value = localStorage.getItem("model-commons:uploader") || "";
  renderQueue();
  loadAllCategories();
}

initialize();
