declare enum RecordStatus {
  NEW = "new",
  PENDING = "pending",
  APPROVED = "approved",
  DENIED = "denied",
}

interface TimeRecord {
  date: string;
  customer: Customer;
  hours: number;
  status: RecordStatus;
}

interface TravelRecord {
  date: string;
  kilometers: number;
  status: RecordStatus;
}

interface TimesheetProject {
  customer: Customer
  values: number[]
  isExternal: boolean
}

interface WeeklyTimesheet {
  isReadonly: boolean
  projects: TimesheetProject[]
  travelProject: TimesheetProject | null
  status: RecordStatus
}

interface WorkScheme {
  date: string
  theoreticalHours: number
  absenceHours: number
  workHours: number
  holiday: number
}

interface RecordsStoreState {
  isLoading: boolean
  isSaving: boolean
  lastSaved: Date | null
  selectedWeek: WeekDate[]
  timeRecords: TimeRecord[]
  travelRecords: TravelRecord[]
  workScheme: WorkScheme[]
}
