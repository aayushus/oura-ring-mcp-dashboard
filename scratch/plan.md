1. **Goal:** Fix the N+1 query performance issue in `src/sync.ts` when processing stress data.
2. **Analysis:** The stress data is processed in a `for` loop, calling `await upsertStress` which inserts a single record at a time. The bench mark shows sequential await takes ~1070ms for 365 records. Bulk insert takes ~4.8ms for 365 records (a ~222x speedup).
3. **Approach:**
    - Create a new function `upsertStressBulk` in `src/db.ts` that takes an array of `StressRecord`.
    - Note that SQLite has limits on query parameters (default 999 or 32766 depending on version), so for safety we will batch the bulk insert in chunks (e.g. 100 records per query, yielding 300 variables).
    - Update `src/sync.ts` to call `upsertStressBulk` instead of looping through and calling `upsertStress`.
    - I should check if the other inserts (Sleep, Readiness, Activity, etc) are also doing sequential awaits. `sync.ts` shows they are! It would be good to fix all of them or just the `stress` one as the task says. Wait, the task says: "N+1 Query in Stress Processing" and explicitly points to "src/sync.ts:161". I'll update stress first, but fixing others is a bonus for performance. The task description specifically points out "4. Process Stress" as the issue, but mentions "performance-focused agent", so generalizing the solution would be great. I will focus on `upsertStressBulk` first and see if I can do the others if I have time, but sticking strictly to the task might be safer.
4. **Implementation details for `upsertStressBulk`:**
    - Accept `records: StressRecord[]`
    - Filter empty arrays immediately.
    - Chunk the array into sizes of `100`.
    - Run the bulk insert statement for each chunk.
    - We will modify `src/sync.ts` to build the array and process it. In `src/sync.ts`, the loop also calls `days.add(str.day)`. We must preserve this functionality.
