# HPC metric collectors

Per-HPC Python scripts that run on each login node (via cron), capture
the relevant queue/state command, and push it to the dashboard's
`/api/hpc/push` endpoint.

```
metrics/
├── db.py        # shared HTTP push helper, stdlib only
├── hpc.py    # hpc: qstat -a
└── ...          # add orchid.py, fhpc.py, etc. on the same shape
```

## Deploy

Copy the directory to the HPC user account:

```sh
scp -r metrics you@hpc.example:~/web-dashboard/metrics/
```

`db.py` has no dependencies beyond Python 3.8+ stdlib.

## Run once

```sh
DASHBOARD_URL=http://dashboard.lan:3000 \
WRITE_TOKEN=xxxxxxxx \
  python3 ~/web-dashboard/metrics/hpc.py
```

A successful push exits 0; failure exits non-zero with a message on
stderr (cron's `MAILTO` will pick it up).

## Schedule

In the HPC user's crontab:

```cron
*/5 * * * * DASHBOARD_URL=http://dashboard.lan:3000 WRITE_TOKEN=xxx /home/me/web-dashboard/metrics/hpc.py
```

## Adding a new HPC

Copy `hpc.py` to e.g. `orchid.py` and adjust:

- `HOST = "orchid"`
- `COMMAND = "pjstat"` (or whatever the scheduler's command is)
- `ARGV = ["pjstat", "-A"]`

The file remains a thin wrapper around `db.push`. If output preprocessing
is ever needed (formatting, header trimming), do it inline before the
`push(...)` call — `db.push` only deals with the HTTP wire format.

## Why Python and not bash

`api/cron-samples/push.sh` is the curl-based equivalent and works fine
for the common case. Python becomes worth it once a host needs more than
a single command (e.g., combine `qstat` + `df`), needs to parse output,
or needs richer error logging — all easier to write in 30 lines of
Python than in shell glue.
