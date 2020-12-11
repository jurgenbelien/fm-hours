import { isWithinInterval, isSameDay, formatISO, startOfISOWeek, addDays, subDays } from 'date-fns';
import { debounce } from '../helpers/debounce';

export const state = () => ({
    isLoggedin: undefined,
    isAdmin: undefined,
    user: undefined,
    time_records: [],
    lastSaved: undefined
});

const CreateHoursEntry = (date, hours) => {
    return { date: date, hours: hours }
}

const AddRecordToList = (allRecords, newRecord, transformation) => {
    let newRecords = [...allRecords];
    const record = newRecords.find((record) => newRecord.customer === record.customer);
    const hours = CreateHoursEntry(newRecord.date, newRecord.hours);
    if (record) {
        const recordIndex = record.hours.findIndex((record) => isSameDay(new Date(record.date), new Date(newRecord.date)));
        if (recordIndex === -1) {
            record.hours.push(hours);
        } else {
            record.hours[recordIndex] = hours;
        }
    } else {
        newRecords.push(
            {
                customer: newRecord.customer,
                hours: [hours]
            }
        );
    }
    return transformation ? transformation(newRecords) : newRecords;
}

const RemoveRow = (allRecords, newRecord, hoursCondition, transformation) => {
    let newRecords = [...allRecords];
    const recordIndex = newRecords.findIndex((record) => newRecord.customer === record.customer && newRecord.project === record.project);
    const project = {
        ...newRecords[recordIndex],
        hours: newRecords[recordIndex].hours.filter(hoursCondition)
    };
    newRecords[recordIndex] = project;
    return transformation ? transformation(newRecords) : newRecords;
}

const transformToTimeEntryList = (entries) => {
    return entries.reduce((acc, curr) => {
        return [
            ...acc,
            ...curr.hours.map((entry) => {
                return {
                    customer: curr.customer,
                    date: entry.date,
                    hours: entry.hours,
                    debtor: curr.debtor
                }
            })
        ]
    }, []);
}

const debouncer = debounce((fn) => fn(), 2000);

const getRecordsForWeekRange = (records, startDate, endDate) => {
    return records.filter((record) => {
        return record.hours.some((entry) => isWithinInterval(new Date(entry.date), { start: new Date(startDate), end: new Date(endDate)}))
    });
}

export const actions = {
    async login () {
        let provider = new this.$fireModule.auth.GoogleAuthProvider();
        await this.$fire.auth.signInWithPopup(provider);
    },
    async onAuthStateChangedAction (context, { authUser, claims }) {
        if (authUser) {
            const usersRef = this.$fire.firestore.collection('users');
            const user = await usersRef.doc(claims.user_id).get();
            const snapshot = await this.$fire.firestore.collection('admins').get();
            const { admins: adminList } = snapshot.docs[0].data();
            const isAdmin = adminList.some((email) => email === claims.email);
            if (user.exists) {
                context.dispatch('loginSuccess', {id: user.id, ...user.data(), isAdmin});
            } else {
                const newUser = await usersRef.doc(claims.user_id).set({
                    name: claims.name,
                    picture: claims.picture,
                    time_records: [],
                    isAdmin
                });
                context.dispatch('loginSuccess', newUser.data());
            }
        } else {
            console.log('no user');
        }
    },
    loginSuccess (context, payload) {
        context.commit('loginSuccess', payload);
        context.commit('week-dates/setToday', null, {root:true});
    },
    addHoursRecords (context, payload) {
        const timeRecords = context.getters.getRecordsByCustomer;
        const newRecords = AddRecordToList(timeRecords, payload, transformToTimeEntryList);
        context.dispatch('saveToFirestore', { records: newRecords, debounce: true });
        context.commit('updateTimeRecords', newRecords);
    },
    removeRecordRow (context, payload) {
        const {startDate, endDate} = context.rootGetters['week-dates/getcurrentWeekRange'];
        const timeRecords = context.getters.getRecordsByCustomer;
        const newRecords = RemoveRow(
            timeRecords,
            payload,
            (entry) => !isWithinInterval(new Date(entry.date), { start: new Date(startDate), end: new Date(endDate)}),
            transformToTimeEntryList
        );
        context.dispatch('saveToFirestore', { records: newRecords, debounce: false });
        context.commit('updateTimeRecords', newRecords);
    },
    async saveToFirestore (context, payload) {
        const { records, debounce } = payload;
        const saving = () => {
            const user = context.getters.getUser;
            const usersRef = this.$fire.firestore.collection('users').doc(user.id);
            usersRef.set({
                time_records: records
            }, { merge: true });
            context.commit('saveToFirestore');
        }
        if (debounce) {
            debouncer(() => saving());
        } else {
            saving();
        }
    },
    addProjectRow (context, payload) {
        context.commit('addProjectRow', payload);
    },
    copyPrevWeekrecords (context) {
        const records = context.getters.getRecordsByCustomer;
        const allRecords = context.getters.getTimeRecords;
        const currentWeek = context.rootGetters['week-dates/currentWeek'];
        const startDate = subDays(currentWeek[0].date, 7);
        const endDate = addDays(startDate, 6);
        const rows = getRecordsForWeekRange(records, startDate, endDate);
        if (rows.length === 0) {
            return;
        }
        const copiedRecords = rows.reduce((acc, curr) => {
            const newHours = curr.hours.filter((entry) => isWithinInterval(new Date(entry.date), { start: new Date(startDate), end: new Date(endDate)}))
            return [
                ...acc,
                ...newHours.map((entry) => {
                    return {
                        customer: curr.customer,
                        debtor: curr.debtor,
                        date: formatISO(addDays(new Date(entry.date), 7)),
                        hours: entry.hours,
                    }
                })
            ]
        },[]);
        const newRecords = [...allRecords, ...copiedRecords];
        context.commit('updateTimeRecords', newRecords);
        context.dispatch('saveToFirestore', { records: newRecords, debounce: false });
    },
    logout (context) {
        this.$fire.auth.signOut();
        this.app.router.push('/');
        context.commit('logout');
    },
}

export const mutations = {
    loginSuccess: (state, payload) => {
        state.isLoggedin = true;
        state.user = payload;
        state.time_records = payload.time_records;
        state.isAdmin = payload.isAdmin;
    },
    addProjectRow: (state, payload) => {
        state.time_records = [...state.time_records, payload];
    },
    updateTimeRecords: (state, payload) => {
        state.time_records = payload;
    },
    saveToFirestore: (state) => {
        state.lastSaved = new Date();
    },
    logout: (state) => {
        state.isLoggedin = false;
        state.isAdmin = false;
        state.user = undefined;
    },
}

export const getters = {
    getUser: state => {
        return state.user;
    },
    isUserAdmin: state => {
        return state.isAdmin;
    },
    isUserLoggedIn: state => {
        return state.isLoggedin;
    },
    getTimeRecords: (state) => {
        return state.time_records;
    },
    getRecordsByCustomer: (state, getters) => {
        return getters.getTimeRecords.reduce((acc, entry) => {
            let record = acc.find((a) => a.customer === entry.customer);
            if(!record) {
              record = {
                customer: entry.customer,
                hours: [],
                debtor: entry.debtor
              }
              acc.push(record);
            }
            record.hours.push({
              date: entry.date, hours: entry.hours
            });
            return acc;
          }, []);
    },
    getTimeRecordsForCurrentWeek: (state, getters, _, rootGetters) => {
        const timeRecords = getters.getRecordsByCustomer;
        const {startDate, endDate} = rootGetters['week-dates/getcurrentWeekRange'];
        const rows = getRecordsForWeekRange(timeRecords, startDate, endDate);
        return rows;
    },
    getWeekTotals: (state, getters, _, rootGetters) => {
        const currentWeek = rootGetters['week-dates/currentWeek'];
        const currentWeekRecords = getters.getTimeRecordsForCurrentWeek;
        return currentWeek.map((weekDay) => {
            const currDate = new Date(weekDay.date);
            return currentWeekRecords.reduce((acc, curr) => {
                const registeredHours = curr.hours.find((entry) => isSameDay(currDate, new Date(entry.date)));
                return acc + (registeredHours ? registeredHours.hours : 0);
            }, 0);
        });
    },
    getLastSavedDate: (state) => {
        return state.lastSaved;
    },
}