---
description: Switch connections and move through buckets and directories. Search, tags, share links, and how to read fetch times.
---

# Find buckets and files

When you select a connection in Storage, its buckets are listed. Click the star on a bucket you use often to add it to your favorites.

<Screenshot src="/screenshots/storage-buckets.png" alt="Bucket list and favorites in Storage" caption="Click a bucket name to open it. To switch to another storage, use CONNECTION." />

## Move through directories and go back with the breadcrumbs

Click a directory's row to move down one level. Use the breadcrumbs at the top to go back to a parent directory or the bucket list. If the directory has a README, it appears above the file list.

<Screenshot src="/screenshots/storage-directory.png" alt="README and file list of the samples directory" caption="You can check the README, directories, and files on the same screen." />

## Narrow the list with search and tags

File name search is a **prefix match** on the key. To include lower levels as well, turn on **再帰検索** (Recursive search). If the list continues, use the pagination at the bottom to go to the next page.

In environments where tags are enabled, you can add tags to buckets, directories, and files. Use tag search within a connection when you want to search across directories. You manage tag definitions and turn on tag display in **Settings → Features**.

## Check the fetch time and refresh if needed

The list and the README show their fetch time. The color of the list shows how much time has passed since the information was fetched from S3.

| Time elapsed | Display |
| --- | --- |
| Less than 1 hour | No color |
| 1–3 hours | Green |
| 3–6 hours | Yellow |
| 6–12 hours | Orange |
| 12–24 hours | Red |
| 24 hours or more | Dark red |

When you need the latest list, such as right after adding files to S3, click **↻** to fetch it again.

## Copy a Web URL to share

The **⋯** menu on a file offers Web URL, S3 URL, and download.

| Action | Use |
| --- | --- |
| **Web URLをコピー** (Copy Web URL) | Open the mado preview at the same location |
| **S3 URLをコピー** (Copy S3 URL) | Use `s3://bucket/key` in scripts or notes |
| **ダウンロード** (Download) | Save the original file to your computer |

People who receive a Web URL also need access permission for that connection and a network that can reach mado. Copying a link does not grant any access permission.
