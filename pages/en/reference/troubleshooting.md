---
description: What to check when a connection does not appear, a list is out of date, a video does not play, a tar file stays in preparation, or audio analysis does not appear.
---

# Troubleshooting

You can check the version and commit in **About** in Settings. When you report a problem, include the screen you were using, the file format, and the error that was shown.

## A connection does not appear in the list

Check that an administrator has registered the connection in **Settings → Connections**. If it is registered, ask the administrator whether you are on its allowlist. Opening the URL of a connection you are not allowed to see returns 404.

## Buckets or files cannot be retrieved

Check the connection's endpoint, region, access key, path-style, and ListObjects settings. The credentials for the endpoint need permission to list buckets and objects.

If an S3-compatible implementation responds slowly to list requests, reduce the scan page size from 1,000 to 500 or 250 items. Endpoints that point to loopback or link-local addresses are rejected by the endpoint restrictions.

## Files added to S3 do not appear

Click **Reload**, the circular arrow button on the bar above the list, to fetch the information from S3 again. The color and time on the list's bar show how long it has been since that information was fetched.

## Preview or download actions are missing

The operations may be disabled for the connection. Have an administrator check the [connection's operation permissions](../setup/connections.md#connection-capabilities). Even if you open the URL directly, the API applies the same restrictions.

## A video does not play {#video-playback}

Check that your browser supports the video and audio codecs. Even a file with the MP4 extension may not play, depending on the codecs inside it.

Standalone videos and videos inside uncompressed tar files support partial retrieval. Videos inside compressed tar files are subject to the preview size limit, so use uncompressed tar files or standalone files to check large videos.

## A tar listing seems stuck in preparation

For uncompressed tar files, mado fetches the rest of the archive while recording file positions in an index. Archives with many entries can take a while to prepare.

If an error is shown, check its message. If the S3 object has been updated, reloading rebuilds the index for the new content.

## Waveforms or spectrograms are not shown

Check that **Audio information and waveforms** and **Spectrograms** are enabled in the connection settings. The input limit for analysis is 2 GiB for standalone audio files and 100 MiB for audio inside uncompressed tar files. For large audio files, only direct playback may be available.

## You cannot edit a README

Check the Curator or Admin permission, the connection's **Edit READMEs** setting, and S3 write permission on the endpoint. On connections where **Read READMEs** is disabled, editing is not available either.

## No data appears in Lineage

Check the connection to Dataset Registry, the dataset registration, and the results of sending OpenLineage events. Also check that the namespace, name, and version in the graph match what you are looking for.

## You are asked to log in again on a page where you were logged in

If your session has expired, log in again. If you complete the SSO login again in a new tab, return to the original tab afterward.

## Check the logs as an administrator

```bash
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs --tail 100 api-internal
docker compose -f compose.prod.yaml logs --tail 100 media-worker
```

In the development environment, replace `compose.prod.yaml` with `compose.dev.yaml`. Check the time of the error and the services involved in the operation that had the problem.
