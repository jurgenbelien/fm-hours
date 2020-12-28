import { isWithinInterval } from 'date-fns'

// check if two records are the same based on customer and date
export function isSameRecord(record, recordToCompare) {
    return record.customer === recordToCompare.customer && record.date === recordToCompare.date
}

// return records with a date between the start and enddate
export function getRecordsForWeekRange(records, startDate, endDate) {
    return records.filter((entry) =>
        isWithinInterval(new Date(entry.date), {
            start: new Date(startDate),
            end: new Date(endDate),
        })
    );
};

// generate rows for the weekly-value-table component
export function generateWeeklyValuesForTable(records, week) {
    const projects = records.reduce((acc, record) => {
        if (acc.find((r) => r.customer === record.customer)) {
            return acc;
        }
        return [
            ...acc,
            {
                customer: record.customer,
                debtor: record.debtor,
            },
        ];
    }, []);

    // Add the weekly hours to each project
    return projects.map((project) => {
        return {
            ...project,
            values: week.map((day) => {
                const record = records.find(
                    (r) => r.customer === project.customer && r.date === day.date
                );
                return {
                    date: day.date,
                    value: record?.hours || 0,
                };
            }),
        };
    });
}

// formatter for the record registration
export function generateValueFormatter(min, max) {
    return {
        min,
        max,
        formatter: (value) => Math.min(Math.max(Number(value) || 0, min), max),
    };
}