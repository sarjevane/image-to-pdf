import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { downloadBlob, generatePdfFromImage, getPdfFileName } from './pdf'

type UploadStatus = 'idle' | 'generating' | 'error'

type UploadItem = {
  id: string
  file: File
  previewUrl: string
  status: UploadStatus
  error?: string
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function App() {
  const [items, setItems] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [notice, setNotice] = useState(
    'Upload one or more images to create matching PDF downloads.',
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<UploadItem[]>([])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [])

  function openFilePicker() {
    inputRef.current?.click()
  }

  function addFiles(fileList: FileList | File[]) {
    const incomingFiles = Array.from(fileList)

    if (incomingFiles.length === 0) {
      return
    }

    const imageFiles = incomingFiles.filter((file) => file.type.startsWith('image/'))
    const skippedCount = incomingFiles.length - imageFiles.length

    if (imageFiles.length === 0) {
      setNotice('Only image files can be converted to PDFs.')
      return
    }

    const nextItems = imageFiles.map<UploadItem>((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
    }))

    setItems((currentItems) => [...currentItems, ...nextItems])

    if (skippedCount > 0) {
      setNotice(
        `${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} added. ${skippedCount} non-image file${skippedCount === 1 ? ' was' : 's were'} skipped.`,
      )
      return
    }

    setNotice(
      `${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} added and ready to convert.`,
    )
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addFiles(event.target.files)
    }

    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()

    if (!isDragging) {
      setIsDragging(true)
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null

    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsDragging(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  function clearItems() {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl)
    }

    setItems([])
    setNotice('All uploaded images were cleared.')
  }

  function removeItem(id: string) {
    setItems((currentItems) => {
      const itemToRemove = currentItems.find((item) => item.id === id)

      if (itemToRemove) {
        URL.revokeObjectURL(itemToRemove.previewUrl)
      }

      return currentItems.filter((item) => item.id !== id)
    })
  }

  async function handleDownload(item: UploadItem) {
    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, status: 'generating', error: undefined }
          : currentItem,
      ),
    )

    try {
      const pdfBlob = await generatePdfFromImage(item.file)
      downloadBlob(pdfBlob, getPdfFileName(item.file.name))
      setNotice(`Created ${getPdfFileName(item.file.name)}.`)

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, status: 'idle', error: undefined }
            : currentItem,
        ),
      )
    } catch (error) {
      console.error(error)
      setNotice(`Could not create a PDF for ${item.file.name}.`)

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                status: 'error',
                error: 'This image could not be converted. Try another file.',
              }
            : currentItem,
        ),
      )
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Image to PDF</p>
          <h1>Drop in your images and download matching PDFs.</h1>
          <p className="hero-text">
            Choose files with a button click or drag and drop them into the
            upload area. Each image stays separate, keeps its original name, and
            downloads as its own PDF.
          </p>
        </div>

        <div
          className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={handleInputChange}
          />

          <div className="dropzone-badge" aria-hidden="true">
            PDF
          </div>
          <h2>Upload images</h2>
          <p className="dropzone-text">
            Drag and drop one or more images here, or pick them from your
            device.
          </p>
          <button className="primary-button" type="button" onClick={openFilePicker}>
            Choose images
          </button>
          <p className="dropzone-hint">
            Works best with images your browser can preview, including JPG, PNG,
            WEBP, GIF, and BMP.
          </p>
        </div>

        <p className="notice" role="status">
          {notice}
        </p>
      </section>

      <section className="uploads-panel">
        <div className="section-heading">
          <div>
            <p className="section-label">Ready for download</p>
            <h2>{items.length === 0 ? 'No images uploaded yet' : `${items.length} image${items.length === 1 ? '' : 's'} uploaded`}</h2>
          </div>

          {items.length > 0 ? (
            <button className="secondary-button" type="button" onClick={clearItems}>
              Clear list
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            Add a few images to see them listed here with individual PDF
            download actions.
          </div>
        ) : (
          <ul className="upload-list">
            {items.map((item) => (
              <li className="upload-card" key={item.id}>
                <img
                  className="upload-preview"
                  src={item.previewUrl}
                  alt=""
                />

                <div className="upload-meta">
                  <div className="upload-header">
                    <p className="file-name" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <span className={`status-pill status-${item.status}`}>
                      {item.status === 'generating' ? 'Creating PDF' : 'Ready'}
                    </span>
                  </div>

                  <p className="file-details">
                    {formatFileSize(item.file.size)}{' '}
                    <span aria-hidden="true">•</span>{' '}
                    Downloads as {getPdfFileName(item.file.name)}
                  </p>

                  {item.error ? (
                    <p className="file-error" role="alert">
                      {item.error}
                    </p>
                  ) : (
                    <p className="file-caption">
                      One image becomes one single-page PDF with the same base
                      filename.
                    </p>
                  )}
                </div>

                <div className="upload-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => handleDownload(item)}
                    disabled={item.status === 'generating'}
                  >
                    {item.status === 'generating' ? 'Creating PDF...' : 'Download PDF'}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
