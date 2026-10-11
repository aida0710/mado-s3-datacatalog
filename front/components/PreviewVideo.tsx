import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { api } from '../lib/api/client'
import { useMediaSrc } from '../lib/useMediaSrc'

interface Props {
  connectionId: string
  bucket: string
  k: string
  // tar内エントリのとき: k = tarのキー、entryPath = tar内パス
  entryPath?: string
}

export function PreviewVideo({ connectionId, bucket, k, entryPath }: Props) {
  useLocale()
  const directUrl = entryPath ? null : api.videoUrl(connectionId, bucket, k)
  const archiveEntryUrl = entryPath ? api.tarEntryUrl({ connectionId, bucket, key: k, entry: entryPath }) : null
  const { src, loading, error } = useMediaSrc({ directUrl, archiveEntryUrl, archiveKey: k })
  const label = entryPath ?? k

  return (
    <div className="preview-stack">
      {loading && <p className="muted">{translate("previewVideo.fetchingVideo")}</p>}
      {error && <p className="notice error">{translate("previewVideo.couldNotFetchVideo") + " "}{localizeMessage(error)}</p>}
      {src && (
        <video
          aria-label={translate("previewVideo.videoPreviewOf", { value0: label })}
          className="preview-video"
          src={src}
          controls
          playsInline
          preload="metadata"
        />
      )}
    </div>
  )
}
