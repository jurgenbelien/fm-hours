import { computed, useStore, ref, watch } from "@nuxtjs/composition-api";
import { startOfISOWeek, subDays } from "date-fns";

import { buildWeek, getDayOnGMT } from "~/helpers/dates";
import { recordStatus } from "~/helpers/record-status";
import {
  createWeeklyTimesheet,
  generateValueFormatter,
} from "~/helpers/timesheet";
import { buildEmailData } from "~/helpers/email";

export default (employeeId: string, startTimestamp?: number) => {
  const store = useStore<RootStoreState>();
  const hasUnsavedChanges = ref<Boolean>(false);
  const unsavedWeeklyTimesheet = ref<WeeklyTimesheet>();
  const recordsState = computed(() => store.state.records);
  const timesheetState = computed(() => store.state.timesheets);

  const timesheetStatus = computed(() =>
    timesheetState.value.timesheets[0]
      ? timesheetState.value.timesheets[0].status
      : (recordStatus.NEW as TimesheetStatus)
  );

  const timesheetDenyMessage = computed(() =>
    timesheetState.value.timesheets[0]
      ? timesheetState.value.timesheets[0].reasonOfDenial
      : ""
  );

  const isReadonly = computed(
    () =>
      timesheetStatus.value === recordStatus.APPROVED ||
      timesheetStatus.value === recordStatus.PENDING
  );

  const timesheet = ref<WeeklyTimesheet>({
    projects: [],
    travelProject: null,
  });

  const initialDate = startTimestamp ? getDayOnGMT(startTimestamp) : new Date();

  store.dispatch("records/getRecords", {
    employeeId,
    startDate: initialDate,
  });

  const message = ref<string>(
    timesheetState.value?.timesheets[0]
      ? timesheetState.value?.timesheets[0].message
      : ""
  );
  watch(
    () => timesheetState.value?.timesheets[0],
    () => {
      message.value = timesheetState.value?.timesheets[0]?.message;
    },
    { immediate: true }
  );

  const hasRestDayHours = computed(() => {
    return timesheet.value.projects.reduce((_, project) => {
      return project.values.reduce((acc, value, index) => {
        if (!value) return acc;

        return (
          index === 5 ||
          index === 6 ||
          recordsState.value.selectedWeek[index].isHoliday
        );
      }, false);
    }, false);
  });

  const goToWeek = (to: "current" | "previous" | "next") => {
    if (hasUnsavedChanges.value) {
      const confirmation = confirm(
        "You have unsaved changes, are you sure you want to switch to another week?"
      );

      if (!confirmation) return;
    }

    unsavedWeeklyTimesheet.value = undefined;
    store.dispatch("records/goToWeek", { employeeId, to });
  };

  const addProject = (id: string) => {
    const allCustomers = store.state.customers.customers;
    const customer = allCustomers.find((x) => x.id === id) as Customer;

    timesheet.value.projects.push({
      customer,
      values: Array.from(Array(7), () => 0),
      ids: Array.from(Array(7), () => null),
      isExternal: false,
    });
  };

  const deleteProject = (project: TimesheetProject) => {
    store.dispatch("records/deleteProjectRecords", {
      week: recordsState.value.selectedWeek,
      project,
      employeeId,
    });

    unsavedWeeklyTimesheet.value = {
      projects: timesheet.value.projects.filter(
        (proj) => proj.customer.id !== project.customer.id
      ),
      travelProject: timesheet.value.travelProject,
    };
  };

  const copyPreviousWeek = () => {
    const startDate = new Date(
      getDayOnGMT(recordsState.value.selectedWeek[0].date)
    );
    const prevStartDate = subDays(startDate, 7);
    const previousWeek = buildWeek(startOfISOWeek(prevStartDate), []);

    const previousWeekTimesheet = createWeeklyTimesheet({
      week: previousWeek,
      timeRecords: recordsState.value.timeRecords,
      travelRecords: recordsState.value.travelRecords,
      workScheme: recordsState.value.workScheme,
    });

    const newTimesheet = {
      projects: previousWeekTimesheet.projects.map((project) => ({
        ...project,
        ids: new Array(7).fill(null),
      })),
      travelProject: {
        ...previousWeekTimesheet.travelProject!,
        ids: new Array(7).fill(null),
      },
    };

    timesheet.value = newTimesheet;

    hasUnsavedChanges.value = true;
  };

  watch(
    () => [
      recordsState.value.selectedWeek,
      recordsState.value.timeRecords,
      recordsState.value.travelRecords,
    ],
    () => {
      if (!timesheet.value) {
        hasUnsavedChanges.value = false;
      }

      store.dispatch("timesheets/getTimesheets", {
        date: new Date(recordsState.value.selectedWeek[0].date).getTime(),
        employeeId,
      });

      const newTimesheet = createWeeklyTimesheet({
        week: recordsState.value.selectedWeek,
        timeRecords: recordsState.value.timeRecords,
        travelRecords: recordsState.value.travelRecords,
        workScheme: recordsState.value.workScheme,
      });

      timesheet.value = unsavedWeeklyTimesheet.value
        ? unsavedWeeklyTimesheet.value
        : newTimesheet;

      unsavedWeeklyTimesheet.value = undefined;
    },
    { deep: true }
  );

  const saveTimesheet = (
    newTimesheetStatus: TimesheetStatus,
    denialMessage?: string
  ) => {
    if (newTimesheetStatus === recordStatus.NEW && hasRestDayHours.value) {
      const confirmation = confirm(
        "You have add hours on weekends or holidays, are you sure you want to save this timesheet?"
      );

      if (!confirmation) return;
    }

    unsavedWeeklyTimesheet.value = undefined;

    store.dispatch("records/saveTimesheet", {
      employeeId,
      week: recordsState.value.selectedWeek,
      timesheet: timesheet.value,
    });

    let reasonOfDenial = "";
    if (timesheetState.value.timesheets[0]) {
      reasonOfDenial = timesheetState.value.timesheets[0].reasonOfDenial;
    }
    if (newTimesheetStatus === recordStatus.DENIED && denialMessage) {
      reasonOfDenial = denialMessage;
    } else if (newTimesheetStatus === recordStatus.PENDING) {
      reasonOfDenial = "";
    }

    const newTimesheet = timesheetState.value.timesheets[0]
      ? {
          ...timesheetState.value.timesheets[0],
          status: newTimesheetStatus,
          reasonOfDenial,
          message: message.value || "",
        }
      : {
          employeeId,
          date: new Date(recordsState.value.selectedWeek[0].date).getTime(),
          status: newTimesheetStatus,
          reasonOfDenial,
          message: message.value || "",
        };

    store.dispatch("timesheets/saveTimesheet", newTimesheet);

    hasUnsavedChanges.value = false;
  };

  const denyTimesheet = (employee: Employee, denialMessage: string) => {
    unsavedWeeklyTimesheet.value = undefined;
    const selectedTimesheet = timesheetState.value.timesheets[0];

    if (!selectedTimesheet || selectedTimesheet.status !== recordStatus.PENDING)
      return;

    store.dispatch("records/saveTimesheet", {
      employeeId,
      week: recordsState.value.selectedWeek,
      timesheet: timesheet.value,
    });

    const newTimesheet = {
      ...selectedTimesheet,
      status: recordStatus.DENIED,
      denialMessage,
      message: message.value || "",
    };

    const emailData = buildEmailData({
      employee,
      week: recordsState.value.selectedWeek,
      denialMessage,
    });

    store.dispatch("timesheets/denyTimesheet", {
      timesheet: newTimesheet,
      emailData,
    });

    hasUnsavedChanges.value = false;
  };

  return {
    goToWeek,
    copyPreviousWeek,
    addProject,
    deleteProject,
    hasUnsavedChanges,
    timesheet,
    timesheetFormatter: generateValueFormatter(0, 24),
    kilometerFormatter: generateValueFormatter(0, 9999),
    saveTimesheet,
    timesheetStatus,
    isReadonly,
    timesheetDenyMessage,
    message,
    denyTimesheet,
  };
};
