"""Phase 3d: snapshot data profiles (Lakehouse Monitoring) on 3 silver tables.

Why snapshot, not time series: a new time-series profile only analyzes the 30 days before
it is created (wall-clock). This dataset runs to the simulated as_of_date 2026-12-31, so a
time-series profile would miss most of the 2-year history. Snapshot profiles scan the full
table on every refresh and build history refresh by refresh.

Cost: each refresh rescans the full table (silver_sessions ~7M rows). No schedule is set;
the Phase 7 daily job should trigger a refresh after each pipeline update.

Status 2026-11-12: NOT YET CREATED. The workspace is at its 1,000-monitor limit
(HTTP 429 "Cannot create Monitor because it exceeds the number of limit 1000").
Run this once capacity is freed.
"""
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.dataquality import Monitor, DataProfilingConfig, SnapshotConfig

CATALOG = "mg_aws_serverless_workspace_catalog"
SCHEMA = "game_cx_players"
WAREHOUSE_ID = "ea70e66018f416fb"
USER = "mayur.gupta@databricks.com"

# table -> slicing expressions (low-cardinality columns only, to keep profile cost down)
PROFILES = {
    "silver_sessions": ["game_id"],
    "silver_transactions": ["game_id"],
    "silver_chat_messages": ["channel"],
}

w = WorkspaceClient()
schema_id = w.schemas.get(full_name=f"{CATALOG}.{SCHEMA}").schema_id


def create_snapshot_profile(table_name: str, slicing_exprs: list) -> Monitor:
    """Create a snapshot data profile on a table, skipping it if one already exists.

    Args:
        table_name: Table name inside CATALOG.SCHEMA.
        slicing_exprs: SQL expressions used to slice the profile metrics.

    Returns:
        The existing or newly created Monitor.
    """
    table_id = w.tables.get(full_name=f"{CATALOG}.{SCHEMA}.{table_name}").table_id
    try:
        return w.data_quality.get_monitor(object_type="table", object_id=table_id)
    except NotFound:
        pass
    config = DataProfilingConfig(
        output_schema_id=schema_id,
        assets_dir=f"/Workspace/Users/{USER}/databricks_quality_monitoring/{table_name}",
        snapshot=SnapshotConfig(),
        slicing_exprs=slicing_exprs,
        warehouse_id=WAREHOUSE_ID,
    )
    return w.data_quality.create_monitor(
        monitor=Monitor(object_type="table", object_id=table_id, data_profiling_config=config)
    )


for tbl, slices in PROFILES.items():
    cfg = create_snapshot_profile(tbl, slices).data_profiling_config
    print(f"{tbl}: status={cfg.status} profile_tbl={cfg.profile_metrics_table_name} "
          f"drift_tbl={cfg.drift_metrics_table_name} dashboard={cfg.dashboard_id}")
