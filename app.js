(() => {
  "use strict";
  const STORAGE_KEY = "paper-notes-v1";
  const $ = (selector) => document.querySelector(selector);
  const grid = $("#notes-grid");
  const empty = $("#empty-state");
  const dialog = $("#note-dialog");
  const form = $("#note-form");
  const titleInput = $("#note-title");
  const bodyInput = $("#note-body");
  const searchInput = $("#search-input");
  const state = { notes: [], view: "all", query: "", editingId: null, toastTimer: null };

  function makeId() {
    return (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
      ? globalThis.crypto.randomUUID()
      : "note-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  function normalizeNote(note) {
    if (!note || typeof note !== "object" || typeof note.title !== "string" || typeof note.body !== "string") return null;
    return {
      id: typeof note.id === "string" && note.id ? note.id : makeId(),
      title: note.title.slice(0, 120),
      body: note.body.slice(0, 20000),
      pinned: note.pinned === true,
      createdAt: Number.isFinite(note.createdAt) ? note.createdAt : Date.now(),
      updatedAt: Number.isFinite(note.updatedAt) ? note.updatedAt : Date.now()
    };
  }
  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeNote).filter(Boolean) : [];
    } catch (error) {
      console.warn("Could not read saved notes", error);
      return [];
    }
  }
  function saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
      $("#save-status").textContent = "Saved on this device";
      return true;
    } catch (error) {
      $("#save-status").textContent = "Storage unavailable";
      showToast("Could not save notes. Check your browser storage.");
      return false;
    }
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }
  function formatDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
  }
  function visibleNotes() {
    const query = state.query.trim().toLocaleLowerCase();
    return state.notes
      .filter((note) => state.view !== "pinned" || note.pinned)
      .filter((note) => !query || (note.title + "\n" + note.body).toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }
  function render() {
    const notes = visibleNotes();
    grid.innerHTML = notes.map((note) => {
      const preview = note.body.length > 230 ? note.body.slice(0, 230) + "…" : note.body;
      return '<article class="note-card' + (note.pinned ? ' pinned' : '') + '" data-note-id="' + escapeHTML(note.id) + '">' +
        '<div class="note-card-top"><span class="note-date">' + escapeHTML(formatDate(note.updatedAt)) + '</span>' +
        (note.pinned ? '<span class="pin-badge">⌑ Pinned</span>' : '') +
        '<div class="card-menu"><button class="icon-button" data-action="pin" aria-label="' + (note.pinned ? 'Unpin ' : 'Pin ') + escapeHTML(note.title) + '" title="' + (note.pinned ? 'Unpin note' : 'Pin note') + '">' + (note.pinned ? '⌑' : '◇') + '</button>' +
        '<button class="icon-button" data-action="delete" aria-label="Delete ' + escapeHTML(note.title) + '" title="Delete note">×</button></div></div>' +
        '<h3>' + escapeHTML(note.title) + '</h3><p class="note-preview">' + escapeHTML(preview) + '</p>' +
        '<div class="note-card-bottom"><span class="note-tag">' + Math.max(1, note.body.trim().split(/\s+/).filter(Boolean).length) + ' WORDS</span>' +
        '<button class="edit-link" data-action="edit">Open note ↗</button></div></article>';
    }).join("");
    empty.classList.toggle("visible", notes.length === 0);
    grid.hidden = notes.length === 0;
    if (notes.length === 0) {
      if (state.query) {
        $("#empty-title").textContent = "No notes found.";
        $("#empty-copy").textContent = "Try another search term, or create a new note.";
      } else if (state.view === "pinned") {
        $("#empty-title").textContent = "Nothing pinned just yet.";
        $("#empty-copy").textContent = "Pin the notes you want to find quickly.";
      } else {
        $("#empty-title").textContent = "A blank page is full of possibility.";
        $("#empty-copy").textContent = "Create your first note and give that thought somewhere to live.";
      }
    }
    $("#all-count").textContent = state.notes.length;
    $("#pinned-count").textContent = state.notes.filter((note) => note.pinned).length;
    $("#summary-count").textContent = state.notes.length + (state.notes.length === 1 ? " note" : " notes");
    $("#page-title").textContent = state.view === "pinned" ? "Pinned notes" : "All notes";
    $("#section-title").textContent = state.query ? "Search results" : state.view === "pinned" ? "Kept close" : "Recently written";
    $("#section-subtitle").textContent = state.query ? notes.length + " matching " + (notes.length === 1 ? "note" : "notes") : "Your notes, just as you left them.";
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  }
  function openEditor(note) {
    state.editingId = note ? note.id : null;
    $("#dialog-title").textContent = note ? "Edit your note" : "A new thought";
    titleInput.value = note ? note.title : "";
    bodyInput.value = note ? note.body : "";
    $("#form-error").textContent = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    titleInput.focus();
  }
  function closeEditor() {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    state.editingId = null;
    form.reset();
    $("#form-error").textContent = "";
  }
  function saveFromForm(event) {
    event.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    if (!title || !body) {
      $("#form-error").textContent = "Add both a title and some note content before saving.";
      return;
    }
    const now = Date.now();
    if (state.editingId) {
      const note = state.notes.find((item) => item.id === state.editingId);
      if (!note) {
        $("#form-error").textContent = "This note is no longer available. Close the editor and try again.";
        return;
      }
      note.title = title.slice(0, 120);
      note.body = body.slice(0, 20000);
      note.updatedAt = now;
      showToast("Note updated");
    } else {
      state.notes.push({ id: makeId(), title: title.slice(0, 120), body: body.slice(0, 20000), pinned: false, createdAt: now, updatedAt: now });
      showToast("Note saved");
    }
    saveNotes();
    closeEditor();
    render();
  }
  function togglePin(id) {
    const note = state.notes.find((item) => item.id === id);
    if (!note) return;
    note.pinned = !note.pinned;
    note.updatedAt = Date.now();
    saveNotes();
    render();
    showToast(note.pinned ? "Note pinned" : "Note unpinned");
  }
  function deleteNote(id) {
    const note = state.notes.find((item) => item.id === id);
    if (!note) return;
    if (!window.confirm('Delete "' + note.title + '"? This cannot be undone.')) return;
    state.notes = state.notes.filter((item) => item.id !== id);
    saveNotes();
    render();
    showToast("Note deleted");
  }
  $("#new-note").addEventListener("click", () => openEditor(null));
  $("#empty-create").addEventListener("click", () => openEditor(null));
  $("#close-dialog").addEventListener("click", closeEditor);
  $("#cancel-edit").addEventListener("click", closeEditor);
  form.addEventListener("submit", saveFromForm);
  searchInput.addEventListener("input", () => { state.query = searchInput.value; render(); });
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    state.view = button.dataset.view;
    render();
  }));
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest("[data-note-id]");
    if (!card) return;
    const id = card.dataset.noteId;
    if (button.dataset.action === "pin") togglePin(id);
    if (button.dataset.action === "delete") deleteNote(id);
    if (button.dataset.action === "edit") {
      const note = state.notes.find((item) => item.id === id);
      if (note) openEditor(note);
    }
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeEditor(); });
  dialog.addEventListener("close", () => { state.editingId = null; });
  state.notes = loadNotes();
  render();
  window.PaperNotes = {
    getNotes: () => state.notes.map((note) => ({ ...note })),
    search: (query) => state.notes.filter((note) => (note.title + "\n" + note.body).toLocaleLowerCase().includes(String(query).toLocaleLowerCase())),
    saveNotes,
    visibleNotes
  };
})();
