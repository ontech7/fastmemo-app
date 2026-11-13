// Every kind of line a text note can hold since 4.1.0, written as the editor writes it (Tasks 9, 16 and 17).
export const TODO_BOX = '<span contenteditable="false" class="x-todo-box"><input type="checkbox"></span>';
export const TODO_BOX_DONE = '<span contenteditable="false" class="x-todo-box"><input type="checkbox" checked=""></span>';
export const EVERY_LINE = [
  "<div>Testo semplice con <b>grassetto</b></div>",
  "<h1>Titolo uno</h1>",
  "<h2>Titolo due</h2>",
  "<blockquote>Una citazione</blockquote>",
  "<pre>codice()</pre>",
  "<ul><li>punto</li></ul>",
  "<ol><li>numero</li></ol>",
  `<ol class="x-todo"><li>${TODO_BOX}da fare</li><li>${TODO_BOX_DONE}fatto</li></ol>`,
  "<hr>",
  '<div>Un <a href="https://example.com/a?b=1">link</a> e una nota <a href="#fm-note-abc123" contenteditable="false">Altra nota</a></div>',
].join("");
export const EVERY_LINE_TEXT = ["Testo semplice con grassetto", "Titolo uno", "Titolo due", "Una citazione", "codice()", "punto", "numero", "da fare", "fatto", "Un link e una nota Altra nota"];
