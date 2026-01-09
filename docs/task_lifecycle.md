Task Lifecycle – Anchor

Problem:
In distributed systems, tasks can be interrupted due to worker crashes or network failures. Without a clear lifecycle, tasks may be lost or executed multiple times.

Goal:
Ensure that every task is executed correctly and exactly once in effect, even in the presence of failures.

Task States

PENDING
The task exists but has not yet been assigned to any worker.

RUNNING
The task is currently being executed by a worker.

COMPLETED
The task finished successfully and must never be re-executed.

FAILED
The task failed permanently after exceeding retry limits or encountering unrecoverable errors.

Core Principles

A task can be in only one state at a time

State transitions are explicit and controlled

No task is ever deleted; history matters

Failure is treated as a normal event