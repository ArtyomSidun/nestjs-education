import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Connection, Repository } from 'typeorm';
import { CreateCoffeeDto } from './dto/create-coffee.dto';
import { UpdateCoffeeDto } from './dto/update-coffee.dto';
import { Coffee } from './entities/coffee.entity';
import { Flavor } from './entities/flavor.entity';
import { Event } from '../events/entities/event.entity';

@Injectable()
export class CoffeesService {
  constructor(
    @InjectRepository(Coffee)
    private readonly coffeeRepository: Repository<Coffee>,
    @InjectRepository(Flavor)
    private readonly flavorRepository: Repository<Flavor>,
    private readonly connection: Connection,
  ) {}

  async findAll(paginationQuery: PaginationQueryDto) {
    const coffees = await this.coffeeRepository.find({
      relations: ['flavors'],
      take: paginationQuery.limit,
      skip: paginationQuery.offset,
    });
    return coffees;
  }

  async findOne(id: number) {
    const coffee = await this.coffeeRepository.findOne({
      where: {
        id,
      },
      relations: ['flavors'],
    });
    if (!coffee) {
      throw new NotFoundException();
    }
    return coffee;
  }

  async create(createDataDto: CreateCoffeeDto) {
    const flavors = await Promise.all(
      createDataDto.flavors.map((flavour) =>
        this.preloadFlavorsByName(flavour),
      ),
    );
    const coffee = this.coffeeRepository.create({ ...createDataDto, flavors });
    return await this.coffeeRepository.save(coffee);
  }

  async update(id: number, updateCoffeeDto: UpdateCoffeeDto) {
    const flavors =
      updateCoffeeDto.flavors &&
      (await Promise.all(
        updateCoffeeDto.flavors.map((flavour) =>
          this.preloadFlavorsByName(flavour),
        ),
      ));
    const coffee = await this.coffeeRepository.preload({
      id,
      ...updateCoffeeDto,
      flavors,
    });
    if (!coffee) {
      throw new NotFoundException();
    }
    return await this.coffeeRepository.save(coffee);
  }

  async delete(id: number) {
    const coffee = await this.findOne(id);
    return await this.coffeeRepository.remove(coffee);
  }

  async preloadFlavorsByName(name: string) {
    const existingFlavor = await this.flavorRepository.findOne({
      where: {
        name,
      },
    });
    if (existingFlavor) {
      return existingFlavor;
    }
    return this.flavorRepository.create({ name });
  }

  async recommendCoffee(coffee: Coffee) {
    const queryRunner = this.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      coffee.recommendations++;
      const event = new Event();
      event.name = 'coffee_recommendation';
      event.type = 'coffee';
      event.payload = { coffeeId: coffee.id };

      await queryRunner.manager.save(coffee);
      await queryRunner.manager.save(event);

      await queryRunner.commitTransaction();
    } catch (error) {
      queryRunner.rollbackTransaction();
    } finally {
      queryRunner.release();
    }
  }
}
