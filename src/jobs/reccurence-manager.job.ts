import { EventRepository } from "../database/repository/event.repository";
import { DateTime } from "luxon";
import { Equal, LessThan, Not } from "typeorm";
import { RecurrencePattern } from "../database/entity/event.entity";

export async function reccurenceManagerJob() {
    const now = DateTime.now();
    const startOfDay = now.startOf('day').toJSDate();

    const eventsToRecur = await EventRepository.find({
        where: {
            targetDate: LessThan(startOfDay),
            childCreated: Equal(false),
            recurrencePattern: Not(Equal(RecurrencePattern.Unique))
        }
    });

    for (const event of eventsToRecur) {
        let nextTargetDate: DateTime;

        if (event.recurrencePattern === RecurrencePattern.Monthly) {
            nextTargetDate = DateTime.fromJSDate(event.targetDate).plus({ months: 1 });
        } else if (event.recurrencePattern === RecurrencePattern.Yearly) {
            nextTargetDate = DateTime.fromJSDate(event.targetDate).plus({ years: 1 });
        } else {
            continue;
        }

        const newEventData = {
            ...event,
            targetDate: nextTargetDate.toJSDate(),
            childCreated: false,
        };

        delete newEventData.id;
        delete newEventData.inviteToken;

        const newEvent = EventRepository.create(newEventData);
        await EventRepository.save(newEvent);

        event.childCreated = true;
        await EventRepository.save(event);
    }
}