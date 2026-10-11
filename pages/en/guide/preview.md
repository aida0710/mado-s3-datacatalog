---
description: Check text, JSON, images, and video without downloading them. Changing the width and pinning.
---

# View text, images, and video

Click a file's row in Storage to open its preview. The preview's location is part of the URL, so sharing that URL opens the same file.

## Read text and JSON

Text and JSON appear in the panel on the right. Click **内容をコピー** (Copy content) to copy the displayed text to the clipboard.

<Screenshot src="/screenshots/text-preview.png" alt="Preview showing the contents of metadata.json on the right" caption="You can read metadata and config files while keeping the file list in view." />

## Open images

Images open in the same preview. To save the original file, use **ダウンロード** (Download) in the header, the button with a down arrow.

<Screenshot src="/screenshots/image-preview.png" alt="Image preview showing spectrogram.png" caption="An image file opened in the preview. You can save the original file with the download button in the header." />

## Play and seek video

Video in formats your browser can play, such as MP4, is supported. For a standalone video file, mado fetches only the parts it needs, so you can play and seek without waiting for the whole file. Files of 500 MB, 1 GB, or larger are also supported.

<Screenshot src="/screenshots/video-preview.png" alt="Video preview showing sample.mp4" caption="Use the browser's player to control the playback position and volume." />

Whether a video plays depends not only on its file extension but also on its video and audio codecs. If no picture appears, see [Troubleshooting](../reference/troubleshooting.md#video-playback).

## Change the width and pin previews side by side

On a wide screen, drag the left edge of the preview to change its width. The browser remembers the width, and **↔** in the header resets it.

Click **ピン留め** (Pin) to keep the preview at the bottom of the screen. You can still see the pinned content after you open another file or move to another directory. For a tar file, you pin individual files inside it, not the whole archive.

<Screenshot src="/screenshots/pinned-preview.png" alt="An image opened while JSON stays pinned at the bottom of the screen" caption="Keep the content you want to refer to and move on to another file." />
