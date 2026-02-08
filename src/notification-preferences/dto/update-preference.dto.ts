import { IsBoolean } from 'class-validator';

export class UpdatePreferenceDto {
  @IsBoolean()
  enabled: boolean;
}
