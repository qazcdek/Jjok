// 테스트 전용: 글자 크기·위치를 정한 텍스트 줄로 1쪽짜리 PDF 를 만든다. 앱 코드에서 import 하지 않는다.

export interface PdfLineSpec {
  text: string;
  /** 글자 크기 (pt) */
  size: number;
  /** 아래에서부터 y 좌표 (pt). 페이지 높이 792 */
  y: number;
  x?: number;
}

const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** Helvetica 로 줄을 그린 PDF. infoTitle 을 주면 문서 정보의 Title 에 넣는다 */
export function makeTextPdf(lines: PdfLineSpec[], { infoTitle }: { infoTitle?: string } = {}) {
  const stream = lines
    .map((l) => `BT /F1 ${l.size} Tf ${l.x ?? 72} ${l.y} Td (${escape(l.text)}) Tj ET`)
    .join("\n");
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${stream.length}>>stream\n${stream}\nendstream`,
    `<</Title(${escape(infoTitle ?? "")})>>`,
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj${obj}endobj\n`;
  });
  const xref = body.length;
  body +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer<</Size ${objects.length + 1}/Root 1 0 R${infoTitle ? "/Info 6 0 R" : ""}>>\n` +
    `startxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}
