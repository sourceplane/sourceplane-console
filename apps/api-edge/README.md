# @sourceplane/api-edge

Public HTTP edge Worker scaffold.

Current scope:

- health endpoint and route inventory
- request ID and trace propagation
- response envelope normalization
- minimal service-binding integration pattern for the identity worker

This Worker should continue to own transport concerns only. Future tasks should keep domain persistence and business logic in bounded-context Workers.
