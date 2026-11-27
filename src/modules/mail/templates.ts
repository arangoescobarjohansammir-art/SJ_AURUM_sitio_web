export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function template(
  title: string,
  lines: string[],
  url: string,
  button: string,
) {
  return {
    subject: "SJ AURUM · " + title,
    text: [
      title,
      ...lines,
      button + ": " + url,
      "SJ AURUM · Entorno de pruebas",
    ].join("\n\n"),
    html:
      '<!doctype html><html lang="es"><body style="margin:0;background:#f5f2ed;font-family:Arial,sans-serif;color:#29251f"><main style="max-width:560px;margin:24px auto;padding:32px;background:white"><p style="letter-spacing:4px;color:#967535">SJ AURUM</p><h1 style="font-family:Georgia,serif">' +
      escapeHtml(title) +
      "</h1>" +
      lines
        .map((s) => '<p style="line-height:1.6">' + escapeHtml(s) + "</p>")
        .join("") +
      '<p><a style="display:inline-block;background:#29251f;color:white;padding:14px 20px;text-decoration:none" href="' +
      escapeHtml(url) +
      '">' +
      escapeHtml(button) +
      '</a></p><p style="font-size:12px;color:#666">Entorno de pruebas. Los pedidos y pagos son de demostración.</p></main></body></html>',
  };
}
