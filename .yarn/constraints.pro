% Yarn Constraints (Prolog)
% Goal: Forbid semver range prefixes ("^" and "~") in all workspaces.
% Allows exact versions (e.g., "1.2.3") and workspace protocol, file, link.

% Violation if any dependency (prod/dev/peer/optional) starts with ^ or ~
:- workspace_has_dependency(Workspace, Ident, Range),
   ( atom_concat('^', _, Range)
   ; atom_concat('~', _, Range)
   ),
   format('Dependency "~w" in workspace "~w" must be pinned (found range "~w").~n', [Ident, Workspace, Range]).

:- workspace_has_dev_dependency(Workspace, Ident, Range),
   ( atom_concat('^', _, Range)
   ; atom_concat('~', _, Range)
   ),
   format('Dev dependency "~w" in workspace "~w" must be pinned (found range "~w").~n', [Ident, Workspace, Range]).

:- workspace_has_peer_dependency(Workspace, Ident, Range),
   ( atom_concat('^', _, Range)
   ; atom_concat('~', _, Range)
   ),
   format('Peer dependency "~w" in workspace "~w" should not use range prefix ("~w").~n', [Ident, Workspace, Range]).

:- workspace_has_optional_dependency(Workspace, Ident, Range),
   ( atom_concat('^', _, Range)
   ; atom_concat('~', _, Range)
   ),
   format('Optional dependency "~w" in workspace "~w" must be pinned (found range "~w").~n', [Ident, Workspace, Range]).

