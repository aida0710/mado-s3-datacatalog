---
description: Configure connections to S3-compatible storage, the default connection, allowlists, operation permissions, and scheduled measurements.
---

# Set up storage connections

You can register and edit S3-compatible storage in **Settings → Connections**. You need Admin permission to manage connections.

<Screenshot src="/screenshots/en/connections.png" alt="Connections screen with Research storage, Archive storage, and AWS S3 registered" caption="For each connection, set the name, purpose, and allowed operations." />

## Register the endpoint and S3 credentials

Click **Add** and enter the name, endpoint, region, access key ID, and secret access key. To change a registered connection, click **Edit** in the list.

<Screenshot src="/screenshots/en/connection-edit.png" alt="Screen for editing the endpoint, region, and credentials of an S3 connection" caption="The endpoint in the image is an example.com sample. No real credentials are shown." />

| Field | What to set |
| --- | --- |
| **Name** | Display name shown in the **Connection** selector in Storage and in the list |
| **Endpoint** | URL of the S3-compatible API |
| **Region** | Region that the endpoint requires |
| **Access key ID** / **Secret access key** | S3 credentials issued for the endpoint |
| path-style | Set to match the endpoint's S3-compatible implementation |
| ListObjects | v1 or v2. Choose the one the endpoint supports |

Credentials are encrypted when saved. If you don't want to change the existing credentials, leave the fields blank as the edit form instructs.

## Choose the default connection for Storage

Click **Set as default** in the connection list to open that connection whenever you open Storage. You can switch to another connection from the **Connection** selector in Storage.

## Limit which users can see a connection

By default, a connection is shown to all logged-in users. To show it only to some users, select **Allowlist** and specify the users to allow.

Users who are not allowed do not see the connection, and opening its URL directly returns 404. Admins who can manage connections still have access so that they can fix the settings.

## Restrict allowed operations per connection {#connection-capabilities}

<Screenshot src="/screenshots/en/connection-capabilities.png" alt="Screen for configuring preview, download, README editing, and other operations per connection" caption="You can keep lists visible while restricting fetching file contents and writing back." />

| Setting | When disabled |
| --- | --- |
| **List buckets and objects** | The lists for this connection cannot be opened |
| **File previews (text / image / audio / video)** | Text, images, audio, and video cannot be opened |
| **File downloads** | The download action is not shown |
| **Open archives (tar / tar.gz / tar.xz)** | The contents of tar and similar archives cannot be opened |
| **Audio information and waveforms** | Audio analysis is not run |
| **Spectrograms** | Spectrograms are not shown |
| **Read READMEs** | READMEs are not shown (and cannot be edited) |
| **Edit READMEs** | READMEs cannot be written back to the bucket |

The API also enforces these restrictions. Connection-level restrictions apply to Admins too, so these settings do more than hide buttons.

## Configure scanning, scheduled measurements, and estimates

**Allow directory scans** and **Allow bucket capacity scans** are separate settings. To use scheduled measurements, enable them and specify the interval.

You can set the scan page size to 100, 250, 500, or 1,000 items. Reduce it for S3-compatible implementations that respond slowly to list requests.

Transfer estimates use each connection's read/write bandwidth, concurrency, provider, and capacity. Update these values once you have measured them.
