import { HttpClient } from '@angular/common/http';
import { Component, NgZone, OnDestroy } from '@angular/core';
import {
  BehaviorSubject,
  debounceTime,
  EMPTY,
  filter,
  from,
  Observable,
  OperatorFunction,
  ReplaySubject,
  shareReplay,
  Subject,
  switchMap,
  takeUntil,
  zip,
} from 'rxjs';
import { concatMap, map, take, tap } from 'rxjs/operators';
import { FirmResponse } from '../shared/models/starwars/firm';
import { SearchResponse } from '../shared/models/starwars/search';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnDestroy {
  onDestroy$ = new ReplaySubject<void>(1);
  keyword$ = new BehaviorSubject<string | null>(null);

  search$ = this.keyword$.pipe(
    filter((keyword) => keyword !== null && keyword !== ''),
    debounceTime(300),
    switchMap((keyword) => {
      return this.http.get<SearchResponse>(
        `https://swapi.dev/api/people/?search=${keyword}`
      );
    }),
    shareReplay(1)
  );

  firmsAsName: { [name: string]: FirmResponse[] } = {};

  intersect$ = new Subject<void>();

  results$ = this.search$.pipe(map((response) => response.results));

  constructor(private http: HttpClient, private zone: NgZone) {
    this.search$
      .pipe(
        switchMap((response) => {
          this.firmsAsName = {};
          return from(response.results).pipe(
            concatMap((character) => {
              return this.concatFilms(character.films, character.name);
            })
          );
        }),
        takeUntil(this.onDestroy$)
      )
      .subscribe();
  }

  concatFilms(flims: string[], characterName: string) {
    return from(flims).pipe(
      concatMap((filmUrl) => {
        return this.http.get<FirmResponse>(filmUrl).pipe(
          tap((response) => {
            // display
            this.firmsAsName[characterName] = [
              ...(this.firmsAsName[characterName] ??= []),
              response,
            ];
            this.firmsAsName = { ...this.firmsAsName };
          }),
          this.untilIntersect()
        );
      })
    );
  }

  untilIntersect<T>(): OperatorFunction<T, T> {
    return (source: Observable<T>) => {
      const target = zip([source, this.intersect$]).pipe(
        take(1),
        map(([value, intersect]) => value)
      );
      return target;
    };
  }

  inputKeyword(keyword: string) {
    this.keyword$.next(keyword);
  }

  nextFilm() {
    this.intersect$.next();
  }

  ngOnDestroy(): void {
    this.onDestroy$.next();
  }
}
