---
description: Bucket capacity over time, breakdowns by directory, totals for a directory's contents, and the cost and time of moving data to another storage.
---

# Check capacity changes and transfer costs

**容量メトリクス** (Capacity metrics) in a connection show the results of periodically measuring each bucket's capacity and object count. For the directories directly under a bucket, you can also see a breakdown of the top 50 by capacity.

<Screenshot src="/screenshots/capacity.png" alt="Capacity metrics trend chart and breakdown by directory" caption="Switch the time range to see increases and decreases for each bucket or directory." />

## Open a bucket's trend and breakdown

Open **容量メトリクス** from the connection's menu in Storage. Choose a time range and open a bucket's row to see its breakdown. From a directory's row, you can also see that directory's trend.

**表示を更新** (Refresh view) reloads the saved measurement results. To count S3 capacity again, use **今すぐ全バケットを計測** (Measure all buckets now). The measurement interval and whether measurement runs are managed in the [connection settings](../setup/connections.md).

## Count the contents of the directory you have open

If the directory has not been aggregated yet, click **配下を集計する** (Aggregate contents) in the file list. If it has, click **内訳** (Breakdown). You can see the object count, total size, and breakdowns by subdirectory and by extension. Aggregation uses S3 list requests and does not download file contents.

<Screenshot src="/screenshots/scan.png" alt="Object count, size, and breakdown by extension for a directory's contents" caption="Completed aggregation results are still there the next time you open them." />

## Compare the cost and time for each destination

After aggregation, open **移送の見積もり** (Transfer estimate) to compare the cost and time of moving the data to another connection. This is an estimate only; the screen does not transfer any files.

<Screenshot src="/screenshots/estimate.png" alt="Transfer estimates to Archive storage and AWS S3" caption="The costs and times on this screen are sample values set up for the screenshot." />

| Column | What it includes |
| --- | --- |
| **所要** (Duration) | Optimistic to pessimistic time, based on bandwidth and object count |
| **初期** (Upfront) | Costs of egress from the source, retrieval, and GET and PUT requests |
| **月額** (Monthly) | Additional cost of keeping the data stored at the destination |

If you set the read and write bandwidth in the connection settings to measured values, the time estimates reflect them. Free tiers and existing usage are not taken into account, so these numbers are not the amount you will actually be billed.
