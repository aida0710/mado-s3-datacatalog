---
description: Trace Datasets and Jobs, and DatasetVersions and Runs, in a graph to see how data was processed and where it is stored.
---

# Trace data lineage with Dataset Lineage

In DataLineage, you can see how source data, processing, and generated data connect. The source of truth for metadata is Dataset Registry, and mado shows OpenLineage events and manually registered information.

<Screenshot src="/screenshots/lineage.png" alt="Dataset Lineage connecting the source audio, noise removal, and the processed audio" caption="From left to right: source data, processing, and generated data. Select a node to open its details." />

## Choose a dataset from the catalog

Open DataLineage, filter the catalog by name or namespace, and select a dataset. Its upstream and downstream appear in the graph. Change the depth to adjust how far the graph traces.

You can drag the graph to move it, and zoom in and out. Select a node to see its registered description and run information on the right.

## Switch between the overall view and the per-version view

| View | Relationship |
| --- | --- |
| Logical | Dataset → Job → Dataset. The overall picture of data and processing |
| Version | DatasetVersion → Run → DatasetVersion. Specific generated results and runs |

In a version's details, you can check registered information such as the content hash, the storage location, and the Run that generated it. If the storage location is linked to a mado connection, you can go to it in Storage. From Storage, you can also see the Lineage linked to the same storage location.

## Choose between manual registration and sending from a pipeline

A Curator or Admin can register datasets, storage locations, and processing history from the screen. Use this when organizing existing data.

To send continuously from a pipeline, use a Service Account key with `lineage:write`. [API settings](../reference/api.md) covers how to specify the destination and scope.

If no Lineage information is registered, mado does not infer the lineage on its own. Check the registration status and the projection status.
