import argparse
import json
import sys
from datetime import date, datetime, time
from decimal import Decimal

import adodbapi


def _convert_value(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except Exception:
            return value.decode("latin-1", errors="ignore")
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--conn", required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--max-rows", type=int, default=0)
    args = parser.parse_args()

    conn = adodbapi.connect(args.conn)
    try:
        cur = conn.cursor()
        cur.execute(args.query)
        if args.max_rows and args.max_rows > 0:
            rows = cur.fetchmany(args.max_rows)
        else:
            rows = cur.fetchall()
        columns = [d[0] for d in cur.description] if cur.description else []
        rows_out = [[_convert_value(v) for v in row] for row in rows]
        print(json.dumps({"columns": columns, "rows": rows_out}, ensure_ascii=False))
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
