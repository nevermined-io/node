import { Injectable } from '@nestjs/common';
import { Dtp } from '@nevermined-io/nevermined-sdk-dtp/dist/Dtp';
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../../config';

@Injectable()
export class NeverminedService {
    nevermined: Nevermined;
    // TODO: handle configuration properly
    async onModuleInit() {
        this.nevermined = await Nevermined.getInstance(config);
        const instanceConfig = {
            ...generateIntantiableConfigFromConfig(config),
            nevermined: this.nevermined,
        };
        await Dtp.getInstance(instanceConfig);
    }
    getNevermined() {
        return this.nevermined
    }
}

