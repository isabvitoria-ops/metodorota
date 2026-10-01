/**
 * Baixa um objeto como arquivo .json. O endereço é solto depois de um
 * instante: soltar na hora faz alguns navegadores baixarem um arquivo vazio.
 */
export function baixarJson(nomeDoArquivo: string, dados: unknown): number {
  const texto = JSON.stringify(dados, null, 2);
  const endereco = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nomeDoArquivo;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 4000);
  return Math.max(1, Math.round(texto.length / 1024));
}
