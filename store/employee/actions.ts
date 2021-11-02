import type {ActionTree} from 'vuex';

import EmployeesService from '~/services/employees-service';
import {generateAvatarURL} from '~/helpers/employee';

const actions: ActionTree<EmployeeStoreState, RootStoreState> = {
  async getEmployee({commit, rootState}) {
    if (!rootState.auth.user) return;

    try {
      const employeesService = new EmployeesService(this.$fire);
      const {user} = rootState.auth;

      const employee = await employeesService.getEmployee(user.email);
      const isAdmin = await employeesService.isAdmin(user.email);

      if (!employee) throw new Error('Employee not found!');

      // Retrieve BridgeUid if we haven't done this before
      if (!employee.bridgeUid) {
        const {
          data: {bridgeUid},
        } = await this.$axios.get<{bridgeUid: string}>('/api/user/me', {
          headers: {Authorization: user.samlToken},
        });

        await employeesService.updateEmployee({
          ...employee!,
          picture: employee.picture || generateAvatarURL(employee.name),
          bridgeUid: employee.bridgeUid || bridgeUid,
          standBy: employee.standBy || false,
        });
      }

      // Add project details
      const [employeeProjects, defaultProjects] = await Promise.all([
        await this.app.$customersService.getCustomersByIds(employee.projects),
        await this.app.$customersService.getDefaultCustomers(),
      ]);

      const projects = [...employeeProjects, ...defaultProjects];

      commit('setEmployee', {employee, isAdmin, projects});

      return employee;
    } catch (error) {
      throw new Error(error);
    }
  },
};

export default actions;
