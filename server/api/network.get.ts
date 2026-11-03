import { networkInterfaces } from 'node:os'
import { defineEventHandler } from 'nuxt/server'

function rank(address: string): number {
  if (address.startsWith('192.168.')) return 0
  if (address.startsWith('10.')) return 1
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2
  return 3
}

/** Adresses IPv4 de la machine sur le réseau local, pour le QR code des téléphones. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter(info => info && info.family === 'IPv4' && !info.internal)
    .map(info => info!.address)
    .sort((a, b) => rank(a) - rank(b))
  return { addresses }
})
