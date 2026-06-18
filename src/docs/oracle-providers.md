# Oracle Providers

Implement `OracleProvider` in `src/oracle/OracleProvider.ts`, then register it in
`src/oracle/oracleRegistry.ts`.

The `/ask` command should call `askYesNo` with the question, odds, d100 roll, and
active Chaos Factor. The `/scene` command should call `setupScene` with the
scene prompt, scene check roll, and active Chaos Factor.

External or user-provided table data can be loaded later through persistence or
file access. Do not hardcode proprietary oracle tables unless the user has the
right to use them.
