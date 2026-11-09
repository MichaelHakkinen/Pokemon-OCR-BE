import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';
import { OptionService } from './option.service';
import {
  ApiCommonErrorResponses,
  ApiSuccessResponse,
} from 'src/common/swagger/response.schemas';
import {
  AdminGroupOptionEntity,
  ModuleRuleOptionGroupEntity,
} from './entities/option.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

/**
 * Read-only dropdown/option endpoints for admin UI forms. Behind AdminAuthGuard
 * like every other admin route, but does not call `checkAuthorization()` against
 * any specific module rule — any authenticated admin can read these lists.
 */
@ApiTags('Option')
@ApiBearerAuth()
@Controller('option')
@UseGuards(AdminAuthGuard)
export class OptionController {
  private readonly moduleName: string = 'Option Management';

  constructor(private readonly optionService: OptionService) {}

  @ApiOperation({
    summary: 'Admin Group',
    description:
      'Returns active, non-deleted admin groups (excluding the built-in "*root" group) ' +
      'as `{ id, name }` dropdown items, ordered by name. No specific module rule is ' +
      'checked — any authenticated admin can call this.',
  })
  @ApiSuccessResponse(AdminGroupOptionEntity, { isArray: true })
  @ApiCommonErrorResponses()
  @Get('admin-groups')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async getAdminGroups() {
    const data = await this.optionService.getAdminGroups();

    return data;
  }

  @ApiOperation({
    summary: 'Module Rule',
    description:
      'Returns module rules (belonging to active, non-deleted modules; non-deleted rules ' +
      'only) grouped by their parent module, as `{ id, name, rules: [{ id, name }] }` items, ' +
      'ordered by module name then rule name. No specific module rule is checked — any ' +
      'authenticated admin can call this.',
  })
  @ApiSuccessResponse(ModuleRuleOptionGroupEntity, { isArray: true })
  @ApiCommonErrorResponses()
  @Get('module-rules')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async getModuleRules() {
    const data = await this.optionService.getModuleRules();

    return data;
  }
}
