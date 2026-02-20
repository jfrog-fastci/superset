import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BASH_DIR, BIN_DIR, ZSH_DIR } from "./paths";

const ZSH_RC = path.join(ZSH_DIR, ".zshrc");
const BASH_RCFILE = path.join(BASH_DIR, "rcfile");

/** Agent binaries that get wrapper shims to guarantee resolution. */
const SHIMMED_BINARIES = ["claude", "codex", "opencode", "gemini"];

/**
 * Shell function shims that override PATH-based lookup.
 * Functions take precedence over PATH in both zsh and bash,
 * so even if a precmd hook or .zlogin re-orders PATH, the
 * wrapped binary is always invoked.
 */
function buildShimFunctions(): string {
	return SHIMMED_BINARIES.map(
		(name) => `${name}() { "${BIN_DIR}/${name}" "$@"; }`,
	).join("\n");
}

export function createZshWrapper(): void {
	// .zprofile must NOT reset ZDOTDIR — our .zshrc needs to run after it
	const zprofilePath = path.join(ZSH_DIR, ".zprofile");
	const zprofileScript = `# Superset zsh profile wrapper
_superset_home="\${SUPERSET_ORIG_ZDOTDIR:-$HOME}"
[[ -f "$_superset_home/.zprofile" ]] && source "$_superset_home/.zprofile"
`;
	fs.writeFileSync(zprofilePath, zprofileScript, { mode: 0o644 });

	// Reset ZDOTDIR before sourcing so Oh My Zsh works correctly
	const zshrcPath = path.join(ZSH_DIR, ".zshrc");
	const zshrcScript = `# Superset zsh rc wrapper
_superset_home="\${SUPERSET_ORIG_ZDOTDIR:-$HOME}"
export ZDOTDIR="$_superset_home"
[[ -f "$_superset_home/.zshrc" ]] && source "$_superset_home/.zshrc"
export PATH="${BIN_DIR}:$PATH"
rehash 2>/dev/null
${buildShimFunctions()}
# Restore ZDOTDIR so our .zlogin runs after user's .zlogin
export ZDOTDIR="${ZSH_DIR}"
`;
	fs.writeFileSync(zshrcPath, zshrcScript, { mode: 0o644 });

	// .zlogin runs AFTER .zshrc in login shells. By restoring ZDOTDIR above,
	// zsh sources our .zlogin instead of the user's directly. We source the
	// user's .zlogin here, then re-prepend BIN_DIR so tools like mise, nvm,
	// or manual PATH exports in .zlogin can't shadow our wrapper.
	const zloginPath = path.join(ZSH_DIR, ".zlogin");
	const zloginScript = `# Superset zsh login wrapper
_superset_home="\${SUPERSET_ORIG_ZDOTDIR:-$HOME}"
[[ -o interactive && -f "$_superset_home/.zlogin" ]] && source "$_superset_home/.zlogin"
export PATH="${BIN_DIR}:$PATH"
rehash 2>/dev/null
export ZDOTDIR="$_superset_home"
`;
	fs.writeFileSync(zloginPath, zloginScript, { mode: 0o644 });

	console.log("[agent-setup] Created zsh wrapper");
}

export function createBashWrapper(): void {
	const rcfilePath = path.join(BASH_DIR, "rcfile");
	const script = `# Superset bash rcfile wrapper

# Source system profile
[[ -f /etc/profile ]] && source /etc/profile

# Source user's login profile
if [[ -f "$HOME/.bash_profile" ]]; then
  source "$HOME/.bash_profile"
elif [[ -f "$HOME/.bash_login" ]]; then
  source "$HOME/.bash_login"
elif [[ -f "$HOME/.profile" ]]; then
  source "$HOME/.profile"
fi

# Source bashrc if separate
[[ -f "$HOME/.bashrc" ]] && source "$HOME/.bashrc"

# Prepend superset bin to PATH
export PATH="${BIN_DIR}:$PATH"
hash -r 2>/dev/null
${buildShimFunctions()}
# Minimal prompt (path/env shown in toolbar) - emerald to match app theme
export PS1=$'\\[\\e[1;38;2;52;211;153m\\]❯\\[\\e[0m\\] '
`;
	fs.writeFileSync(rcfilePath, script, { mode: 0o644 });
	console.log("[agent-setup] Created bash wrapper");
}

export function getShellEnv(shell: string): Record<string, string> {
	if (shell.includes("zsh")) {
		return {
			SUPERSET_ORIG_ZDOTDIR: process.env.ZDOTDIR || os.homedir(),
			ZDOTDIR: ZSH_DIR,
		};
	}
	return {};
}

export function getShellArgs(shell: string): string[] {
	if (shell.includes("zsh")) {
		return ["-l"];
	}
	if (shell.includes("bash")) {
		return ["--rcfile", BASH_RCFILE];
	}
	return [];
}

/**
 * Shell args for non-interactive command execution (`-c`) that sources
 * user profiles via wrappers. Falls back to login shell if wrappers
 * don't exist yet (e.g. before setupAgentHooks runs).
 *
 * Unlike getShellArgs (interactive), we must source profiles inline because:
 * - zsh skips .zshrc for non-interactive shells
 * - bash ignores --rcfile when -c is present
 */
export function getCommandShellArgs(shell: string, command: string): string[] {
	if (shell.includes("zsh") && fs.existsSync(ZSH_RC)) {
		return ["-lc", `source "${ZSH_RC}" && ${command}`];
	}
	if (shell.includes("bash") && fs.existsSync(BASH_RCFILE)) {
		return ["-c", `source "${BASH_RCFILE}" && ${command}`];
	}
	return ["-lc", command];
}
