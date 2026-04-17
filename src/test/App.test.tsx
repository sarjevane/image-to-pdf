import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { downloadBlob, generatePdfFromImage } from '../pdf'

vi.mock('../pdf', async () => {
  const actual = await vi.importActual<typeof import('../pdf')>('../pdf')

  return {
    ...actual,
    generatePdfFromImage: vi.fn(
      async () => new Blob(['pdf'], { type: 'application/pdf' }),
    ),
    downloadBlob: vi.fn(),
  }
})

function createImageFile(name: string, type: string) {
  return new File(['image-bytes'], name, { type })
}

async function uploadWithPicker(files: File[]) {
  const user = userEvent.setup()
  const input = document.querySelector('input[type="file"]')

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected a file input to exist.')
  }

  await user.upload(input, files)
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists selected images and preserves the matching pdf file names', async () => {
    render(<App />)

    const firstFile = createImageFile('week-1.jpg', 'image/jpeg')
    const secondFile = createImageFile('week-2.png', 'image/png')

    await uploadWithPicker([firstFile, secondFile])

    expect(await screen.findByText('week-1.jpg')).toBeInTheDocument()
    expect(screen.getByText('week-2.png')).toBeInTheDocument()
    expect(screen.getByText(/Downloads as week-1\.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/Downloads as week-2\.pdf/)).toBeInTheDocument()
  })

  it('accepts drag-and-drop images and skips non-image files', async () => {
    render(<App />)

    const imageFile = createImageFile('week-3.webp', 'image/webp')
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const dropzoneHeading = screen.getByRole('heading', { name: 'Upload images' })
    const dropzone = dropzoneHeading.closest('.dropzone')

    if (!dropzone) {
      throw new Error('Expected the dropzone to exist.')
    }

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [imageFile, textFile],
      },
    })

    expect(await screen.findByText('week-3.webp')).toBeInTheDocument()
    expect(
      screen.getByText(/1 image added\. 1 non-image file was skipped\./),
    ).toBeInTheDocument()
  })

  it('creates a matching pdf download for each uploaded image', async () => {
    const mockedGeneratePdfFromImage = vi.mocked(generatePdfFromImage)
    const mockedDownloadBlob = vi.mocked(downloadBlob)

    render(<App />)

    const firstFile = createImageFile('week-1.jpg', 'image/jpeg')
    const secondFile = createImageFile('week-2.jpg', 'image/jpeg')

    await uploadWithPicker([firstFile, secondFile])

    const downloadButtons = await screen.findAllByRole('button', {
      name: 'Download PDF',
    })

    await userEvent.click(downloadButtons[0])
    await waitFor(() => {
      expect(mockedGeneratePdfFromImage).toHaveBeenCalledWith(firstFile)
      expect(mockedDownloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'week-1.pdf',
      )
    })
    expect(screen.getByText('Created week-1.pdf.')).toBeInTheDocument()

    await userEvent.click(downloadButtons[1])
    await waitFor(() => {
      expect(mockedGeneratePdfFromImage).toHaveBeenCalledWith(secondFile)
      expect(mockedDownloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'week-2.pdf',
      )
    })
    expect(screen.getByText('Created week-2.pdf.')).toBeInTheDocument()
  })
})
