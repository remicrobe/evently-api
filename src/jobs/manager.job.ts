import * as cron from 'node-cron';
import {reccurenceManagerJob} from "./reccurence-manager.job";

export function initJobs() {
    cron.schedule('* * * * *', async () => {
        await reccurenceManagerJob()
    });
}
