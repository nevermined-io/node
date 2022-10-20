import { ApiProperty } from "@nestjs/swagger"
import { IsString } from "class-validator"

export class LoginDto {
    @ApiProperty({
        description: 'The Authorization Bearer token',
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjIyIn0.eyJpc3Mi[...omitted for brevity...]'
    })
    @IsString()
    access_token: string
}