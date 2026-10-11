---
description: Bucket capacity over time, breakdowns by directory, totals for a directory's contents, and the cost and time of moving data to another storage.
---

# Check capacity changes and transfer costs

**Bucket capacity metrics** in a connection show the results of periodically measuring each bucket's capacity and object count. For the directories directly under a bucket, you can also see a breakdown of the top 50 by capacity.

<Screenshot src="/screenshots/en/capacity.png" alt="Capacity metrics trend chart and breakdown by directory" caption="Switch the time range to see increases and decreases for each bucket or directory." />

## Open a bucket's trend and breakdown

In Storage, open the bucket list and click **View bucket capacity metrics** below the search boxes. Inside a bucket, the same link below the bucket title opens that bucket's results. Choose a time range and open a bucket's row to see its breakdown. From a directory's row, you can also see that directory's trend.

**Refresh view** reloads the saved measurement results. To count S3 capacity again, use **Measure all buckets now**. The measurement interval and whether measurement runs are managed in the [connection settings](../setup/connections.md).

## Count the contents of the directory you have open

If the directory has not been aggregated yet, click **Summarize directory** in the file list. If it has, click **Breakdown**. You can see the object count, total size, and breakdowns by subdirectory and by extension. Aggregation uses S3 list requests and does not download file contents.

<Screenshot src="/screenshots/en/scan.png" alt="Object count, size, and breakdown by extension for a directory's contents" caption="Completed aggregation results are still there the next time you open them." />

## Compare the cost and time for each destination

After aggregation, open **Transfer estimate** to compare the cost and time of moving the data to another connection. This is an estimate only; the screen does not transfer any files.

<Screenshot src="/screenshots/en/estimate.png" alt="Transfer estimates to Archive storage and AWS S3" caption="The costs and times on this screen are sample values set up for the screenshot." />

| Column | What it includes |
| --- | --- |
| **Duration** | Optimistic to pessimistic time, based on bandwidth and object count |
| **Initial cost** | Costs of egress from the source, retrieval, and GET and PUT requests |
| **Monthly cost** | Additional cost of keeping the data stored at the destination |

If you set the read and write bandwidth in the connection settings to measured values, the time estimates reflect them. Free tiers and existing usage are not taken into account, so these numbers are not the amount you will actually be billed.
