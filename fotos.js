// Fotos anexadas ao chamado.
//
// A regra que sustenta tudo aqui: a foto NUNCA entra no banco. No chamado fica
// só o endereço dela (~100 bytes), e a imagem mora em armazenamento próprio.
//
// Isso importa especialmente neste sistema porque o painel carrega TODOS os
// chamados de uma vez quando o técnico abre. Hoje são 355 chamados somando
// 208 KB — instantâneo. Com as fotos dentro, cada abertura do painel baixaria
// centenas de MB no 4G do chão de fábrica.

export const MAX_FOTOS = 3;
const LADO_MAXIMO = 1600;     // suficiente pra ler etiqueta e ver peça
const QUALIDADE   = 0.75;     // acima disso o arquivo cresce sem ganho visível
const LIMITE_ENTRADA = 25 * 1024 * 1024;

/**
 * Reduz a foto ANTES de sair do celular: ~3 MB viram ~250 KB.
 * É o passo que decide se isso pesa ou não — sem ele, o volume é 12x maior.
 */
export async function comprimir(arquivo) {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Só dá para anexar imagem.');
  }
  if (arquivo.size > LIMITE_ENTRADA) {
    throw new Error('Essa imagem é grande demais. Tire a foto pelo próprio sistema.');
  }

  const bitmap = await criarBitmap(arquivo);
  try {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura  = Math.round(bitmap.height * escala);

    const tela = document.createElement('canvas');
    tela.width = largura;
    tela.height = altura;
    const ctx = tela.getContext('2d');
    // Fundo branco: PNG com transparência viraria preto ao salvar em JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise((ok, falha) =>
      tela.toBlob(b => b ? ok(b) : falha(new Error('não consegui processar a imagem')),
                  'image/jpeg', QUALIDADE));
    return blob;
  } finally {
    if (bitmap.close) bitmap.close();   // libera a memória no celular
  }
}

// createImageBitmap já corrige a orientação da foto pelo EXIF — sem isso, foto
// tirada em pé aparece deitada. Em navegador antigo cai no <img>, que o próprio
// navegador costuma orientar.
function criarBitmap(arquivo) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      .catch(() => viaImg(arquivo));
  }
  return viaImg(arquivo);
}

function viaImg(arquivo) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('não consegui ler a imagem')); };
    img.src = url;
  });
}

/** Envia a foto já comprimida e devolve o endereço dela. */
export async function enviar(worker, blob, docId) {
  // O chamado vai junto: o servidor só aceita foto de atendimento em andamento,
  // que é o que impede a rota de virar depósito aberto.
  const resposta = await fetch(worker + '/fotos?chamado=' + encodeURIComponent(docId), {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob
  });
  if (!resposta.ok) {
    const e = await resposta.json().catch(() => ({}));
    throw new Error(e.erro || 'não consegui enviar a foto');
  }
  return (await resposta.json()).url;
}

export const emKB = blob => Math.round(blob.size / 1024);
