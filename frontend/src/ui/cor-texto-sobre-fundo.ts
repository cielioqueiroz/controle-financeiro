/** Escolhe a tinta preta ou branca que oferece mais contraste para uma cor hex. */
export function corTextoSobreFundo(cor: string): string {
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(cor)
  if (!hex) return '#000000'

  const linearizar = (canal: string) => {
    const valor = Number.parseInt(canal, 16) / 255
    return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4
  }
  const luminancia = 0.2126 * linearizar(hex[1]) + 0.7152 * linearizar(hex[2]) + 0.0722 * linearizar(hex[3])
  return luminancia > 0.179 ? '#000000' : '#ffffff'
}
