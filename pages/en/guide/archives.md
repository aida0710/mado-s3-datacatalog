---
description: List the entries in tar, tar.gz, and tar.xz files and open individual text files or videos.
---

# Open the contents of a tar file

Click a `.tar`, `.tar.gz`, or `.tar.xz` file in Storage to open a list of the files inside the archive. You do not need to extract it and upload the files to S3 again.

<Screenshot src="/screenshots/en/tar-list.png" alt="List of MP4 and JSON files inside dataset-00001.tar" caption="Check entry names and sizes to choose a file to open." />

## Select an entry to preview it

Select a file in the list to open text, images, audio, or video individually. For JSON, you can copy the contents. For audio, you can add it to the synchronized player. An entry's **Actions** menu (**⋯**) also includes pin and download.

<Screenshot src="/screenshots/en/tar-entry.png" alt="sample-001.json inside a tar file opened in the preview" caption="Check JSON inside an archive on its own. The share URL also includes the entry name." />

## Fetch large videos partially from uncompressed tar files

For an uncompressed `.tar`, mado fetches from S3 only the ranges needed for playback. Even if a video inside the tar is 500 MB, 1 GB, or larger, you do not need to wait for all of its data to be fetched before it plays. File positions are saved in an index, which the list, playback, and seeking all share.

| Format | How it is read |
| --- | --- |
| `.tar` | Fetches headers and the needed file data partially. Keeps fetching the rest until the index is complete |
| `.tar.gz` / `.tar.xz` | Decompresses sequentially from the start. A preview limit applies to file data |

File data inside compressed tar files is limited by `MDC_PREVIEW_TAR_ENTRY_MAX_BYTES`. Waveform and spectrogram analysis of audio has its own input limit, which is different from the limit for direct playback.

While `range request…` with an entry count and the amount read is shown above the list, mado is still fetching the rest of the index. When the object is updated, the index is rebuilt.
