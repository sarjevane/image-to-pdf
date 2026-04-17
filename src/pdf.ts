function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the selected image.'))
    image.src = source
  })
}

async function readFileBytes(file: Blob) {
  const response = new Response(file)
  return new Uint8Array(await response.arrayBuffer())
}

async function fileToPngBytes(file: File) {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    const canvas = document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Could not access the canvas renderer.')
    }

    // Transparent image formats need a white background in the exported PDF.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error('Could not prepare the image for PDF export.'))
      }, 'image/png')
    })

    return new Uint8Array(await pngBlob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function embedImageFromFile(
  pdfDocument: Awaited<ReturnType<(typeof import('pdf-lib'))['PDFDocument']['create']>>,
  file: File,
) {
  const mimeType = file.type.toLowerCase()

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return pdfDocument.embedJpg(await readFileBytes(file))
  }

  if (mimeType === 'image/png') {
    return pdfDocument.embedPng(await readFileBytes(file))
  }

  // Fall back to a lossless PNG conversion for browser-supported formats
  // that pdf-lib cannot embed directly, such as WEBP, GIF, and BMP.
  return pdfDocument.embedPng(await fileToPngBytes(file))
}

export function getPdfFileName(fileName: string) {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, '')
  return `${nameWithoutExtension || fileName}.pdf`
}

export async function generatePdfFromImage(file: File) {
  const { PDFDocument } = await import('pdf-lib')
  const pdfDocument = await PDFDocument.create()
  const embeddedImage = await embedImageFromFile(pdfDocument, file)
  const { width, height } = embeddedImage.scale(1)
  const page = pdfDocument.addPage([width, height])

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height,
  })

  const pdfBytes = await pdfDocument.save()
  const pdfArray = new Uint8Array(pdfBytes)

  return new Blob([pdfArray.buffer], { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}
