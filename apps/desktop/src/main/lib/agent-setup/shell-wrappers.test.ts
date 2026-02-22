import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const TEST_ROOT = path.join(
	tmpdir(),
	`superset-shell-wrappers-${process.pid}-${Date.now()}`,
);
const TEST_BIN_DIR = path.join(TEST_ROOT, "bin");
const TEST_ZSH_DIR = path.join(TEST_ROOT, "zsh");
const TEST_BASH_DIR = path.join(TEST_ROOT, "bash");
const TEST_HOOKS_DIR = path.join(TEST_ROOT, "hooks");
const TEST_OPENCODE_CONFIG_DIR = path.join(TEST_HOOKS_DIR, "opencode");
const TEST_OPENCODE_PLUGIN_DIR = path.join(TEST_OPENCODE_CONFIG_DIR, "plugin");

mock.module("./paths", () => ({
	BIN_DIR: TEST_BIN_DIR,
	HOOKS_DIR: TEST_HOOKS_DIR,
	ZSH_DIR: TEST_ZSH_DIR,
	BASH_DIR: TEST_BASH_DIR,
	OPENCODE_CONFIG_DIR: TEST_OPENCODE_CONFIG_DIR,
	OPENCODE_PLUGIN_DIR: TEST_OPENCODE_PLUGIN_DIR,
}));

const { createBashWrapper, createZshWrapper, getCommandShellArgs } =
	await import("./shell-wrappers");

describe("shell-wrappers", () => {
	beforeEach(() => {
		mkdirSync(TEST_BIN_DIR, { recursive: true });
		mkdirSync(TEST_ZSH_DIR, { recursive: true });
		mkdirSync(TEST_BASH_DIR, { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_ROOT, { recursive: true, force: true });
	});

	it("creates zsh wrappers for all profile files with PATH prepend", () => {
		createZshWrapper();

		const zshenv = readFileSync(path.join(TEST_ZSH_DIR, ".zshenv"), "utf-8");
		const zprofile = readFileSync(
			path.join(TEST_ZSH_DIR, ".zprofile"),
			"utf-8",
		);
		const zshrc = readFileSync(path.join(TEST_ZSH_DIR, ".zshrc"), "utf-8");
		const zlogin = readFileSync(path.join(TEST_ZSH_DIR, ".zlogin"), "utf-8");
		const zlogout = readFileSync(
			path.join(TEST_ZSH_DIR, ".zlogout"),
			"utf-8",
		);

		// All profile files source their user equivalents
		expect(zshenv).toContain('source "$_superset_home/.zshenv"');
		expect(zprofile).toContain('source "$_superset_home/.zprofile"');
		expect(zshrc).toContain('source "$_superset_home/.zshrc"');
		expect(zlogin).toContain('source "$_superset_home/.zlogin"');
		expect(zlogout).toContain('source "$_superset_home/.zlogout"');

		// PATH prepend ensures `which claude` resolves to our wrapper
		expect(zshrc).toContain(`PATH="${TEST_BIN_DIR}:$PATH"`);
		expect(zlogin).toContain(`PATH="${TEST_BIN_DIR}:$PATH"`);
	});

	it("creates bash wrapper with PATH prepend", () => {
		createBashWrapper();

		const rcfile = readFileSync(path.join(TEST_BASH_DIR, "rcfile"), "utf-8");
		expect(rcfile).toContain(`PATH="${TEST_BIN_DIR}:$PATH"`);
	});

	it("uses login zsh command args when wrappers exist", () => {
		createZshWrapper();

		const args = getCommandShellArgs("/bin/zsh", "echo ok");
		expect(args).toEqual([
			"-lc",
			`source "${path.join(TEST_ZSH_DIR, ".zshrc")}" && echo ok`,
		]);
	});

	it("falls back to login shell args when zsh wrappers are missing", () => {
		const args = getCommandShellArgs("/bin/zsh", "echo ok");
		expect(args).toEqual(["-lc", "echo ok"]);
	});
});
