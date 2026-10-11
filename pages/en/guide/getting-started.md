---
description: Sign in, move through connections, buckets, and directories, and preview your first file.
---

# Using mado

mado is a web tool for browsing several S3-compatible storages in one place. From your browser, you can open files and check each directory's README, capacity, and data lineage.

The screenshots in this guide were taken of the current version of mado using public sample data. Click an image to enlarge it.

## Sign in at the URL your administrator gave you

Open the mado URL in your browser. If your environment uses SSO, click the SSO button. If it uses Local User, enter the username and password your administrator gave you. If you are asked to change your password the first time you sign in, complete the change.

<Screenshot src="/screenshots/en/login.png" alt="Sign-in screen with a choice of Local User or SSO" caption="The sign-in methods available to you depend on your administrator's settings." />

## Switch the display language

The screens are available in English and Japanese. Switch the language with the **Language** button (the globe icon) at the right of the top bar. On the sign-in screen and the first password change screen, it is to the right of the logo.

Your choice is saved in the browser and applies to other tabs in the same browser. Until you choose, mado follows your browser's language, and shows English when the browser does not report a language or reports one other than English or Japanese. Screen names such as Home, Storage, DataLineage, and Settings stay in English on the Japanese screens as well.

## Open your first file from Storage

1. Open **Storage** in the sidebar on the left (on a phone, open it from the menu button at the top left). If there is a default connection, it opens automatically.
2. Select a bucket and move down through the directories.
3. Click a file's row to open its preview on the right.

To switch connections, use the **Connection** selector to the right of the page title. If there are no connections yet, an administrator needs to [register the storage](../setup/connections.md).

<Screenshot src="/screenshots/en/storage-buckets.png" alt="Storage screen showing the buckets in use and the other buckets" caption="Check the buckets you use often so you can open them from the top of the list." />

<Screenshot src="/screenshots/en/text-preview.png" alt="metadata.json opened to the right of the file list" caption="You can read JSON and text files in place and copy their contents." />

## Choose a screen for what you want to do

| Screen | What you can do |
| --- | --- |
| Home | Read and edit the Team note shared across the team |
| Storage | Check files, READMEs, and capacity metrics |
| DataLineage | Trace how data and processing connect in a graph |
| Settings | Configure connections, features, accounts, and access permissions |

Start with [finding buckets and files](./storage.md). To compare audio, see [the synchronized player](./audio.md). To look at data inside a tar file, see [browsing archives](./archives.md).
