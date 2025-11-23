#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

function uppercaseNames(obj) {
  if (Array.isArray(obj)) {
    return obj.map(uppercaseNames)
  }
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'name' && typeof v === 'string') {
        out[k] = v.toLocaleUpperCase('vi-VN')
      } else {
        out[k] = uppercaseNames(v)
      }
    }
    return out
  }
  return obj
}

function main() {
  const inFile = process.argv[2]
  if (!inFile) {
    console.error('Usage: node scripts/uppercase-json-names.js <input.json>')
    process.exit(1)
  }
  const abs = path.resolve(inFile)
  const text = fs.readFileSync(abs, 'utf8')
  const data = JSON.parse(text)
  const out = uppercaseNames(data)
  fs.writeFileSync(abs, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(`Uppercased names written to: ${abs}`)
}

main()
