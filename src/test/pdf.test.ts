import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePdfFromImage } from '../pdf'

const createMock = vi.fn()
const embedJpgMock = vi.fn()
const embedPngMock = vi.fn()
const addPageMock = vi.fn()
const saveMock = vi.fn()
const drawImageMock = vi.fn()

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: createMock,
  },
}))

function createPdfDocumentMock() {
  return {
    embedJpg: embedJpgMock,
    embedPng: embedPngMock,
    addPage: addPageMock,
    save: saveMock,
  }
}

describe('generatePdfFromImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const embeddedImage = {
      scale: vi.fn(() => ({
        width: 640,
        height: 480,
      })),
    }

    createMock.mockResolvedValue(createPdfDocumentMock())
    embedJpgMock.mockResolvedValue(embeddedImage)
    embedPngMock.mockResolvedValue(embeddedImage)
    addPageMock.mockReturnValue({
      drawImage: drawImageMock,
    })
    saveMock.mockResolvedValue(new Uint8Array([1, 2, 3]))
  })

  it('embeds jpeg uploads directly without rasterizing them through canvas', async () => {
    const file = new File(['jpeg-bytes'], 'photo.jpg', { type: 'image/jpeg' })

    await generatePdfFromImage(file)

    expect(embedJpgMock).toHaveBeenCalledOnce()
    expect(embedPngMock).not.toHaveBeenCalled()
  })

  it('embeds png uploads directly without re-encoding them', async () => {
    const file = new File(['png-bytes'], 'graphic.png', { type: 'image/png' })

    await generatePdfFromImage(file)

    expect(embedPngMock).toHaveBeenCalledOnce()
    expect(embedJpgMock).not.toHaveBeenCalled()
  })
})
