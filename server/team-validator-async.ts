/**
 * Team Validator
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * Spawns a child process to validate teams.
 *
 * @license MIT
 */

import { crashlogger } from '../lib/crashlogger';
import { QueryProcessManager } from './../lib/process-manager';

import { Repl } from './../.lib-dist/repl';
import { Dex } from './../.sim-dist/dex';
import { TeamValidator } from './../.sim-dist/team-validator';
import * as config from './../config/config';
import * as Chat from './chat';

class ValidatorAsync {
	format: Format;

	constructor(format?: string | Format) {
		this.format = Dex.getFormat(format);
	}

	validateTeam(team: string, removeNicknames: boolean = false) {
		let formatid: ID = this.format.id;

		if (this.format.customRules) {
			formatid += `@@@${this.format.customRules.join(',')}`;
		}
		return PM.query({formatid, removeNicknames, team});
	}
}

const PM = new QueryProcessManager(module, async (message: AnyObject) => {
	const { formatid, removeNicknames, team } = message;
	const parsedTeam: PokemonSet[] | null = Dex.fastUnpackTeam(team);

	let problems: string[] | null;

	try {
		problems = TeamValidator(formatid).validateTeam(parsedTeam, removeNicknames);
	} catch (err) {
		crashlogger(err, 'A Team  Validation', { formatid, team });
		problems = [`Your team crashed the team validator. `
			+ `We've been automatically notified and will fix this crash, `
			+ `but you should use a different team for now.`];
	}

	if (problems && problems.length) {
		return '0' + problems.join('\n');
	}

	return 1 + Dex.packTeam(parsedTeam);

});

if (!PM.isParentProcess) {
	global.Config = config;

	global.TeamValidator = TeamValidator;

	global.Monitor = {
		crashlog(error: Error, source: string = 'A team validator process', details: any = null) {
			const repr = JSON.stringify([error.name, error.message, source, details]);
			if (process.send) {
				process.send(`THROW\n@!!@${repr}\n${error.stack}`);
			}
		},
	};

	if (Config.crashgaurd) {
		process.on('uncaughtException', (err: Error) => {
			Monitor.crashlog(err, 'A Team Validator process');
		});
	}

	process.on('unhandledRejection', err => {
		if (err instanceof Error) {
			Monitor.crashlog(err, 'A team validator process Promise');
		}
	});

	global.Dex = Dex.includeData();
	global.toID = Dex.getId;
	global.Chat = Chat;

	Repl.start(`team-validator-${process.pid}`, (cmd: string) => eval(cmd));
} else {
		PM.spawn(global.Config ? Config.validatorprocesses : 1);
}

function getAsyncValidator(format: string): ValidatorAsync {
	return new ValidatorAsync(format);
}

export = Object.assign(getAsyncValidator, { ValidatorAsync, PM });
