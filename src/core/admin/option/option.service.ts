import { Injectable } from '@nestjs/common';
import { OptionModel } from 'src/models';

@Injectable()
export class OptionService {
  constructor(private readonly optionModel: OptionModel) {}

  async getAdminGroups(): Promise<any> {
    const adminGroups = await this.optionModel.getAdminGroups();

    return adminGroups;
  }

  async getModuleRules(): Promise<any> {
    const moduleRules = await this.optionModel.getModuleRules();

    const moduleMap = new Map();

    moduleRules.forEach((rule) => {
      const moduleId = rule.module.id;

      if (!moduleMap.has(moduleId)) {
        moduleMap.set(moduleId, {
          id: rule.module.id,
          name: rule.module.name,
          rules: [],
        });
      }

      moduleMap.get(moduleId).rules.push({
        id: rule.id,
        name: rule.name,
      });
    });

    return Array.from(moduleMap.values());
  }
}
